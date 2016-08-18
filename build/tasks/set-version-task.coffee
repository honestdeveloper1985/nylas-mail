fs = require 'fs'
path = require 'path'

module.exports = (grunt) ->
  {spawn} = require('./task-helpers')(grunt)

  getVersion = (callback) ->
    onBuildMachine = process.env.JANKY_SHA1 and process.env.JANKY_BRANCH is 'master'
    onWindows = process.platform is 'win32'
    inRepository = fs.existsSync(path.resolve(__dirname, '..', '..', '.git'))
    {version} = require(path.join(grunt.config.get('nylasGruntConfig.appDir'), 'package.json'))
    if onBuildMachine or onWindows or not inRepository
      callback(null, version)
    else
      # NOTE: We need to attach the commit hash to the version so it will match
      # properly with the S3 bucket we're supposed to download new releases
      # from.
      cmd = 'git'
      args = ['rev-parse', '--short', 'HEAD']
      spawn {cmd, args}, (error, {stdout}={}, code) ->
        commitHash = stdout?.trim?()
        combinedVersion = "#{version}-#{commitHash}"
        callback(error, combinedVersion)

  grunt.registerTask 'set-version', 'Set the version in the plist and package.json', ->
    done = @async()

    getVersion (error, version) ->
      if error?
        done(error)
        return

      appDir = grunt.config.get('nylasGruntConfig.appDir')

      # Replace version field of package.json.
      packageJsonPath = path.join(appDir, 'package.json')
      packageJson = require(packageJsonPath)
      packageJson.version = version
      packageJsonString = JSON.stringify(packageJson)
      fs.writeFileSync(packageJsonPath, packageJsonString)

      if process.platform is 'darwin'
        cmd = 'script/set-version'
        args = [grunt.config.get('nylasGruntConfig.buildDir'), version]
        spawn {cmd, args}, (error, result, code) -> done(error)

      else if process.platform is 'win32'
        shellAppDir = grunt.config.get('nylasGruntConfig.shellAppDir')
        shellExePath = path.join(shellAppDir, 'nylas.exe')

        year = new Date().getFullYear()
        strings =
          CompanyName: 'Nylas, Inc.'
          FileDescription: 'Nylas'
          LegalCopyright: "Copyright (C) 2014-#{year} Nylas, Inc. All rights reserved"
          ProductName: 'Nylas'
          ProductVersion: version

        rcedit = require('rcedit')
        rcedit(shellExePath, {'version-string': strings}, done)
      else
        done()
