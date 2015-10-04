React = require 'react'
_ = require "underscore"
PackageSet = require './package-set'
PackagesStore = require './packages-store'
PluginsActions = require './plugins-actions'
{Spinner, EventedIFrame, Flexbox} = require 'nylas-component-kit'
classNames = require 'classnames'

class TabExplore extends React.Component
  @displayName: 'TabExplore'

  constructor: (@props) ->
    @state = @_getStateFromStores()

  render: =>
    if @state.search.length
      collectionPrefix = "Matching "
      if @state.searchResults
        collection = @state.searchResults
        emptyText = "No results found."
      else
        collection = {packages: [], themes: []}
        emptyText = "Loading results..."
    else
      collection = @state.featured
      collectionPrefix = "Featured "
      emptyText = null

    <div className="explore">
      <div className="inner">
        <input
          type="search"
          value={@state.search}
          onChange={@_onSearchChange }
          placeholder="Search Packages and Themes"/>
        <PackageSet
          title="#{collectionPrefix} Themes"
          emptyText={emptyText ? "There are no featured themes yet."}
          packages={collection.themes} />
        <PackageSet
          title="#{collectionPrefix} Packages"
          emptyText={emptyText ? "There are no featured packages yet."}
          packages={collection.packages} />
      </div>
    </div>

  componentDidMount: =>
    @_unsubscribers = []
    @_unsubscribers.push PackagesStore.listen(@_onChange)

    # Trigger a refresh of the featured packages
    PluginsActions.refreshFeaturedPackages()

  componentWillUnmount: =>
    unsubscribe() for unsubscribe in @_unsubscribers

  _getStateFromStores: =>
    featured: PackagesStore.featured()
    search: PackagesStore.globalSearchValue()
    searchResults: PackagesStore.searchResults()

  _onChange: =>
    @setState(@_getStateFromStores())

  _onSearchChange: (event) =>
    PluginsActions.setGlobalSearchValue(event.target.value)


module.exports = TabExplore
