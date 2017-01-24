
module.exports = {
  // This folder list was generated by aggregating examples of user folders
  // that were not properly labeled as trash, sent, or spam.
  // This list was constructed semi automatically, and manuallly verified.
  // Should we encounter problems with account folders in the future, add them
  // below to test for them.
  // Make sure these are lower case! (for comparison purposes)
  localizedCategoryNames: {
    trash: new Set([
      'gel\xc3\xb6scht', 'papierkorb',
      '\xd0\x9a\xd0\xbe\xd1\x80\xd0\xb7\xd0\xb8\xd0\xbd\xd0\xb0',
      '[imap]/trash', 'papelera', 'borradores',
      '[imap]/\xd0\x9a\xd0\xbe\xd1\x80',
      '\xd0\xb7\xd0\xb8\xd0\xbd\xd0\xb0', 'deleted items',
      '\xd0\xa1\xd0\xbc\xd1\x96\xd1\x82\xd1\x82\xd1\x8f',
      'papierkorb/trash', 'gel\xc3\xb6schte elemente',
      'deleted messages', '[gmail]/trash', 'inbox/trash', 'trash',
      'mail/trash', 'inbox.trash']),
    spam: new Set([
      'roskaposti', 'inbox.spam', 'inbox.spam', 'skr\xc3\xa4ppost',
      'spamverdacht', 'spam', 'spam', '[gmail]/spam', '[imap]/spam',
      '\xe5\x9e\x83\xe5\x9c\xbe\xe9\x82\xae\xe4\xbb\xb6', 'junk',
      'junk mail', 'junk e-mail']),
    inbox: new Set([
      'inbox',
    ]),
    sent: new Set([
      'postausgang', 'inbox.gesendet', '[gmail]/sent mail',
      '\xeb\xb3\xb4\xeb\x82\xbc\xed\x8e\xb8\xec\xa7\x80\xed\x95\xa8',
      'elementos enviados', 'sent', 'sent items', 'sent messages',
      'inbox.papierkorb', 'odeslan\xc3\xa9', 'mail/sent-mail',
      'ko\xc5\xa1', 'outbox', 'outbox', 'inbox.sentmail', 'gesendet',
      'ko\xc5\xa1/sent items', 'gesendete elemente']),
    archive: new Set([
      'archive',
    ]),
    drafts: new Set([
      'drafts', 'draft', 'brouillons',
    ]),
  },
}
