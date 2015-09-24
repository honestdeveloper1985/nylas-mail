Reflux = require 'reflux'

OnboardingActions = Reflux.createActions [
  "changeAPIEnvironment"
  "loadExternalAuthPage"

  "moveToPreviousPage"
  "moveToPage"
  "accountJSONReceived"
]

for key, action of OnboardingActions
  action.sync = true

module.exports = OnboardingActions
