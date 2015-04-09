_ = require 'underscore-plus'

Tag = require './tag'
Model = require './model'
Contact = require './contact'
Actions = require '../actions'
Attributes = require '../attributes'

Function::getter = (prop, get) ->
  Object.defineProperty @prototype, prop, {get, configurable: yes}

module.exports =
class Thread extends Model

  @attributes: _.extend {}, Model.attributes,

    'snippet': Attributes.String
      modelKey: 'snippet'

    'subject': Attributes.String
      modelKey: 'subject'

    'unread': Attributes.Boolean
      queryable: true
      modelKey: 'unread'

    'version': Attributes.Number
      modelKey: 'version'

    'tags': Attributes.Collection
      queryable: true
      modelKey: 'tags'
      itemClass: Tag

    'participants': Attributes.Collection
      modelKey: 'participants'
      itemClass: Contact

    'lastMessageTimestamp': Attributes.DateTime
      queryable: true
      modelKey: 'lastMessageTimestamp'
      jsonKey: 'last_message_timestamp'

  @naturalSortOrder: ->
    Thread.attributes.lastMessageTimestamp.descending()

  @getter 'unread', -> @isUnread()
  
  tagIds: ->
    _.map @tags, (tag) -> tag.id
  
  hasTagId: (id) ->
    @tagIds().indexOf(id) != -1

  isUnread: ->
    @hasTagId('unread')

  isStarred: ->
    @hasTagId('starred')

  star: ->
    @addRemoveTags(['starred'], [])

  unstar: ->
    @addRemoveTags([], ['starred'])

  toggleStar: ->
    if @isStarred()
      @unstar()
    else
      @star()

  addRemoveTags: (tagIdsToAdd, tagIdsToRemove) ->
    # start web change, which will dispatch more actions
    AddRemoveTagsTask = require '../tasks/add-remove-tags'
    task = new AddRemoveTagsTask(@id, tagIdsToAdd, tagIdsToRemove)
    Actions.queueTask(task)

