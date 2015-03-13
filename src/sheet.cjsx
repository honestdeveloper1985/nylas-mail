React = require 'react'
_ = require 'underscore-plus'
{Actions,ComponentRegistry} = require "inbox-exports"
Flexbox = require './components/flexbox.cjsx'
ResizableRegion = require './components/resizable-region.cjsx'

module.exports =
Sheet = React.createClass
  displayName: 'Sheet'

  propTypes:
    type: React.PropTypes.string.isRequired
    depth: React.PropTypes.number.isRequired
    columns: React.PropTypes.arrayOf(React.PropTypes.string)
    onColumnSizeChanged: React.PropTypes.func

  getDefaultProps: ->
    columns: ['Left', 'Center', 'Right']

  getInitialState: ->
    @_getComponentRegistryState()

  componentDidMount: ->
    @unlistener = ComponentRegistry.listen (event) =>
      @setState(@_getComponentRegistryState())

  componentWillUnmount: ->
    @unlistener() if @unlistener

  render: ->
    style =
      position:'absolute'
      backgroundColor:'white'
      width:'100%'
      height:'100%'

    <div name={"Sheet"}
         style={style}
         data-type={@props.type}>
      <Flexbox direction="row">
        {@_backButtonComponent()}
        {@_columnFlexboxComponents()}
      </Flexbox>
    </div>

  _backButtonComponent: ->
    return [] if @props.depth is 0
    <div onClick={@_pop} key="back">
      Back
    </div>

  _columnFlexboxComponents: ->
    @props.columns.map (column) =>
      classes = @state[column] || []
      return if classes.length is 0

      components = classes.map ({name, view}) => <view key={name} {...@props} />

      maxWidth = _.reduce classes, ((m,{view}) -> Math.min(view.maxWidth ? 10000, m)), 10000
      minWidth = _.reduce classes, ((m,{view}) -> Math.max(view.minWidth ? 0, m)), 0
      resizable = minWidth != maxWidth && column != 'Center'

      if resizable
        if column is 'Left' then handle = ResizableRegion.Handle.Right
        if column is 'Right' then handle = ResizableRegion.Handle.Left
        <ResizableRegion key={"#{@props.type}:#{column}"}
                         name={"#{@props.type}:#{column}"}
                         data-column={column}
                         onResize={@props.onColumnSizeChanged}
                         minWidth={minWidth}
                         maxWidth={maxWidth}
                         handle={handle}>
          <Flexbox direction="column">
            {components}
          </Flexbox>
        </ResizableRegion>
      else
        <Flexbox direction="column"
                 key={"#{@props.type}:#{column}"}
                 name={"#{@props.type}:#{column}"}
                 data-column={column}
                 style={flex: 1}>
          {components}
        </Flexbox>

  _getComponentRegistryState: ->
    state = {}
    for column in @props.columns
      state["#{column}"] = ComponentRegistry.findAllByRole("#{@props.type}:#{column}")
    state

  _pop: ->
    Actions.popSheet()
