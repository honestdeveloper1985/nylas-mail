const request = require('request');
const _ = require('underscore');
const Rx = require('rx');
const {IMAPConnection} = require('isomorphic-core')

const getThreadsForMessages = (db, messages, limit) => {
  const {Message, Folder, Label, Thread, File} = db;
  const threadIds = _.uniq(messages.map((m) => m.threadId));
  return Thread.findAll({
    where: {id: threadIds},
    include: [
      {model: Folder},
      {model: Label},
      {
        model: Message,
        as: 'messages',
        attributes: _.without(Object.keys(Message.attributes), 'body'),
        include: [
          {model: Folder},
          {model: Label},
          {model: File},
        ],
      },
    ],
    limit: limit,
    order: [['lastMessageReceivedDate', 'DESC']],
  });
};

class GmailSearchClient {
  constructor(account) {
    const credentials = account.decryptedCredentials();
    this.accountToken = account.bearerToken(credentials.xoauth2);
    this.account = account;
    this._logger = global.Logger.forAccount(this.account);
  }

  // Note that the Gmail API returns message IDs in hex format. So for
  // example the IMAP X-GM-MSGID 1438297078380071706 corresponds to
  // 13f5db9286538b1a in API responses. Normally we could just use parseInt(id, 16),
  // but many of the IDs returned are outside of the precise range of doubles,
  // so this function accomplishes hex ID parsing using rudimentary arbitrary
  // precision ints implemented using strings.
  _parseHexId(hexId) {
    const add = (a, b) => {
      let carry = 0;
      const x = a.split('').map(Number);
      const y = b.split('').map(Number);
      const result = [];
      while (x.length || y.length) {
        const sum = (x.pop() || 0) + (y.pop() || 0) + carry;
        result.push(sum < 10 ? sum : sum - 10);
        carry = sum < 10 ? 0 : 1;
      }
      if (carry) {
        result.push(carry);
      }
      result.reverse();
      return result.join('');
    };

    let value = '0';
    for (const c of hexId) {
      const digit = parseInt(c, 16);
      for (let mask = 0x8; mask; mask >>= 1) {
        value = add(value, value);
        if (digit & mask) {
          value = add(value, '1');
        }
      }
    }
    return value;
  }

  _search(query, limit) {
    let results = [];
    const params = {q: query, maxResults: limit};

    return new Promise((resolve, reject) => {
      const maxTries = 10;
      const trySearch = (numTries) => {
        if (numTries >= maxTries) {
          // If we've been through the loop 10 times, it means we got a request
          // a crazy-high offset --- raise an error.
          this._logger.error('Too many results:', results.length);
          reject(new Error('Too many results'));
          return;
        }

        request('https://www.googleapis.com/gmail/v1/users/me/messages', {
          qs: params,
          headers: {Authorization: `Bearer ${this.accountToken}`},
        }, (error, response, body) => {
          if (error) {
            reject(new Error(`Error issuing search request: ${error}`));
            return;
          }

          if (response.statusCode !== 200) {
            reject(new Error(`Error issuing search request: ${response.statusMessage}`));
            return;
          }

          let data = null;
          try {
            data = JSON.parse(body);
          } catch (e) {
            reject(new Error(`Error parsing response as JSON: ${e}`));
            return;
          }
          if (!data.messages) {
            resolve(results);
            return;
          }

          // Note that the Gmail API returns message IDs in hex format. So for
          // example the IMAP X-GM-MSGID 1438297078380071706 corresponds to
          // 13f5db9286538b1a in the API response we have here.
          results = results.concat(data.messages.map((m) => this._parseHexId(m.id)));

          if (results.length >= limit) {
            resolve(results.slice(0, limit));
            return;
          }

          if (!data.nextPageToken) {
            resolve(results);
            return;
          }
          params.pageToken = data.nextPageToken;
          trySearch(numTries + 1);
        });
      };
      trySearch(0);
    });
  }

  async searchThreads(db, query, limit) {
    const messageIds = await this._search(query, limit);
    if (!messageIds.length) {
      return [];
    }

    const {Message} = db;
    const messages = await Message.findAll({
      where: {gMsgId: {$in: messageIds}},
    });

    const stringifiedThreads = getThreadsForMessages(db, messages, limit)
      .then((threads) => `${JSON.stringify(threads)}\n`);
    return Rx.Observable.fromPromise(stringifiedThreads);
  }
}

class SearchFolder {
  constructor(folder, criteria) {
    this.folder = folder;
    this.criteria = criteria;
  }

  description() {
    return 'IMAP folder search';
  }

  run(db, imap) {
    return imap.openBox(this.folder.name).then((box) => {
      return box.search(this.criteria);
    });
  }
}

class ImapSearchClient {
  constructor(account) {
    this.account = account;
    this._conn = null;
    this._logger = global.Logger.forAccount(this.account);
  }

  async ensureConnection() {
    if (this._conn) {
      return await this._conn.connect();
    }
    const settings = this.account.connectionSettings;
    const credentials = this.account.decryptedCredentials();

    if (!settings || !settings.imap_host) {
      throw new Error("ensureConnection: There are no IMAP connection settings for this account.");
    }
    if (!credentials) {
      throw new Error("ensureConnection: There are no IMAP connection credentials for this account.");
    }

    const conn = new IMAPConnection({
      db: this._db,
      settings: Object.assign({}, settings, credentials),
      logger: this._logger,
    });

    this._conn = conn;
    return await this._conn.connect();
  }

  closeConnection() {
    if (this._conn) {
      this._conn.end();
    }
  }

  async _search(db, query) {
    await this.ensureConnection();

    // We want to start the search with the 'inbox', 'sent' and 'archive'
    // folders, if they exist.
    const {Folder} = db;
    let folders = await Folder.findAll({
      where: {
        accountId: this.account.id,
        role: ['inbox', 'sent', 'archive'],
      },
    });

    const accountFolders = await Folder.findAll({
      where: {
        accountId: this.account.id,
        id: {$notIn: folders.map((f) => f.id)},
      },
    });

    folders = folders.concat(accountFolders);

    const criteria = [['TEXT', query]];
    return Rx.Observable.create((observer) => {
      const chain = folders.reduce((acc, folder) => {
        return acc.then((uids) => {
          if (uids.length > 0) {
            observer.onNext(uids);
          }
          return this._searchFolder(folder, criteria);
        });
      }, Promise.resolve([]));

      chain.then((uids) => {
        if (uids.length > 0) {
          observer.onNext(uids);
        }
        observer.onCompleted();
      }).finally(() => this.closeConnection());
    });
  }

  _searchFolder(folder, criteria) {
    return this._conn.runOperation(new SearchFolder(folder, criteria))
    .catch((error) => {
      this._logger.error(`Search error: ${error}`);
      return Promise.resolve([]);
    });
  }

  async searchThreads(db, query, limit) {
    const {Message} = db;
    return (await this._search(db, query)).flatMap((uids) => {
      return Message.findAll({
        where: {
          accountId: this.account.id,
          folderImapUID: uids,
        },
      });
    }).flatMap((messages) => {
      return getThreadsForMessages(db, messages, limit);
    }).flatMap((threads) => {
      if (threads.length > 0) {
        return `${JSON.stringify(threads)}\n`;
      }
      return '\n';
    });
  }
}

module.exports.searchClientForAccount = (account) => {
  switch (account.provider) {
    case 'gmail': {
      return new GmailSearchClient(account);
    }
    case 'office365':
    case 'imap': {
      return new ImapSearchClient(account);
    }
    default: {
      throw new Error(`Unsupported provider for search endpoint: ${account.provider}`);
    }
  }
};
