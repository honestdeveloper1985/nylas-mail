React = require "react"
_ = require "underscore"
ContactChip = require './ContactChip'

# Parameters
# clickable (optional) - is this currently clickable?
# thread (optional) - thread context for sorting
#  passed into the ParticipantChip
#  - 'primary'
#  - 'list'

class Participants extends React.Component
  @displayName: "Participants"

  @containerRequired: false

  render: =>
    chips = @getParticipants().map (p) =>
      <ContactChip key={p.toString()} clickable={@props.clickable} participant={p} />

    <span>
      {chips}
    </span>

  getParticipants: =>
    list = @props.participants

    # Remove 'Me' if there is more than one participant
    if list.length > 1
      list = _.reject list, (contact) -> contact.isMe()

    list.forEach (p) ->
      p.serverId ?= p.name+p.email

    list

  shouldComponentUpdate: (newProps, newState) =>
    !_.isEqual(newProps.participants, @props.participants)


module.exports = Participants
