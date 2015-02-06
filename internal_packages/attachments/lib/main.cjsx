{ComponentRegistry} = require 'inbox-exports'

module.exports =
  activate: (@state={}) ->
    AttachmentComponent = require "./attachment-component.cjsx"

    ComponentRegistry.register
      name: 'AttachmentComponent'
      view: AttachmentComponent
      role: 'Attachment'

  deactivate: ->
    ComponentRegistry.unregister "AttachmentComponent"

  serialize: -> @state
