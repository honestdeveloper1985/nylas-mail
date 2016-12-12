/* eslint react/no-render-return-value: 0 */
import React from 'react';
import ReactDOM from 'react-dom';
import {findRenderedDOMComponentWithClass} from 'react-addons-test-utils';

import {DateUtils, NylasAPIHelpers, Actions} from 'nylas-exports'
import SendLaterButton from '../lib/send-later-button';
import {PLUGIN_ID, PLUGIN_NAME} from '../lib/send-later-constants'

const node = document.createElement('div');

const makeButton = (initialState, metadataValue) => {
  const draft = {
    accountId: 'accountId',
    metadataForPluginId: () => metadataValue,
  }
  const session = {
    changes: {
      add: jasmine.createSpy('add'),
      addPluginMetadata: jasmine.createSpy('addPluginMetadata'),
    },
  }
  const button = ReactDOM.render(<SendLaterButton draft={draft} session={session} isValidDraft={() => true} />, node);
  if (initialState) {
    button.setState(initialState)
  }
  return button
};

describe('SendLaterButton', function sendLaterButton() {
  beforeEach(() => {
    spyOn(DateUtils, 'format').andReturn('formatted')
  });

  describe('onSendLater', () => {
    it('sets scheduled date to "saving" and adds plugin metadata to the session', () => {
      const button = makeButton(null, {sendLaterDate: 'date'})
      spyOn(button, 'setState')
      spyOn(NylasAPIHelpers, 'authPlugin').andReturn(Promise.resolve());
      spyOn(Actions, 'ensureDraftSynced')

      const sendLaterDate = {utc: () => 'utc'}
      button.onSendLater(sendLaterDate)
      advanceClock()

      expect(button.setState).toHaveBeenCalledWith({saving: true})
      expect(NylasAPIHelpers.authPlugin).toHaveBeenCalledWith(PLUGIN_ID, PLUGIN_NAME, button.props.draft.accountId)
      expect(button.props.session.changes.addPluginMetadata).toHaveBeenCalledWith(PLUGIN_ID, {sendLaterDate})
    });

    it('displays dialog if an auth error occurs', () => {
      const button = makeButton(null, {sendLaterDate: 'date'})
      spyOn(button, 'setState')
      spyOn(NylasEnv, 'reportError')
      spyOn(NylasEnv, 'showErrorDialog')
      spyOn(NylasAPIHelpers, 'authPlugin').andReturn(Promise.reject(new Error('Oh no!')))
      spyOn(Actions, 'ensureDraftSynced')
      button.onSendLater({utc: () => 'utc'})
      advanceClock()
      expect(NylasEnv.reportError).toHaveBeenCalled()
      expect(NylasEnv.showErrorDialog).toHaveBeenCalled()
    });

    it('closes the composer window if a sendLaterDate has been set', () => {
      const button = makeButton(null, {sendLaterDate: 'date'})
      spyOn(button, 'setState')
      spyOn(NylasEnv, 'close')
      spyOn(NylasAPIHelpers, 'authPlugin').andReturn(Promise.resolve());
      spyOn(NylasEnv, 'isComposerWindow').andReturn(true)
      spyOn(Actions, 'ensureDraftSynced')
      button.onSendLater({utc: () => 'utc'})
      advanceClock()
      expect(NylasEnv.close).toHaveBeenCalled()
    });
  });

  describe('render', () => {
    it('renders spinner if saving', () => {
      const button = ReactDOM.findDOMNode(makeButton({saving: true}, null))
      expect(button.title).toEqual('Saving send date...')
    });

    it('renders date if message is scheduled', () => {
      spyOn(DateUtils, 'futureDateFromString').andReturn({fromNow: () => '5 minutes'})
      const button = makeButton({saving: false}, {sendLaterDate: 'date'})
      const span = ReactDOM.findDOMNode(findRenderedDOMComponentWithClass(button, 'at'))
      expect(span.textContent).toEqual('Sending in 5 minutes')
    });

    it('does not render date if message is not scheduled', () => {
      const button = makeButton(null, null)
      expect(() => {
        findRenderedDOMComponentWithClass(button, 'at')
      }).toThrow()
    });
  });
});
