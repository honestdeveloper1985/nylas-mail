import {AccountStore} from 'nylas-exports'

class N1CloudAPI {
  constructor() {
    NylasEnv.config.onDidChange('env', this._onConfigChanged);
    this._onConfigChanged();
  }

  _onConfigChanged = () => {
    const env = NylasEnv.config.get('env')
    if (['development', 'local'].includes(env)) {
      this.APIRoot = "http://localhost:5100";
    } else {
      this.APIRoot = "https://n1.nylas.com";
    }
  }

  accessTokenForAccountId = (aid) => {
    return AccountStore.tokenForAccountId(aid)
  }
}

export default new N1CloudAPI();
