'use strict'

const debug = require('debug')('parallel')
const path = require('path')
const vm = require('vm')
const confFilename = path.resolve('./conf.js')
const suiteName = 'one'
console.log('parallelizing, assuming conf file\n%s\nsuite name "%s"',
  confFilename, suiteName, +new Date())

const Module = require('module')
const __resolveFilename = Module._resolveFilename
Module._resolveFilename = function (name, from) {
  if (isMockSpecFilename(name)) {
    console.log('resolving mock spec filename', name)
    return name
  }
  const result = __resolveFilename(name, from)
  return result
}

const __loadModule = Module._load
Module._load = function (filename, parent) {
  if (isMockSpecFilename(filename)) {
    debug('loading mock spec module', filename)
    const index = findMock(filename)
    debug('mock spec index', index)
    // const __dirname = path.dirname(filename)
    // const __filename = filename
    // debug('filename', __filename, 'dirname', __dirname)
    debug('before evaluating', filename)

    const sandbox = {}
    vm.createContext(sandbox)
    sandbox.__filename = filename
    sandbox.__dirname = path.dirname(filename)
    sandbox.console = console
    sandbox.require = require
    const src = mockSpecs[index]
    const result = eval(src) // eslint-disable-line no-eval
    // const result = vm.runInContext(src, sandbox)
    return result
  }
  return __loadModule(filename, parent)
}

const fs = require('fs')
const _readFileSync = fs.readFileSync
const conf = fs.readFileSync(confFilename, 'utf8')
const config = eval(conf) // eslint-disable-line no-eval
const specFilename = path.resolve(config.suites[suiteName])
debug('spec "%s" filename from conf', suiteName, specFilename)

const _existsSync = fs.existsSync
fs.existsSync = function (filename) {
  debug('file exists?', filename)
  return _existsSync(filename)
}
const _readdirSync = fs.readdirSync
fs.readdirSync = function (path) {
  debug('loading files in', path)
  return _readdirSync(path)
}
const _lstatSync = fs.lstatSync
fs.lstatSync = function (filename) {
  if (isMockSpecFilename(filename)) {
    debug('lstat on mock spec filename', filename)
    return {
      isSymbolicLink: () => false,
      isDirectory: () => false
    }
  }
  return _lstatSync(filename)
}

const spec = fs.readFileSync(specFilename, 'utf8')
const sep = 'describe('
const specParts = spec.split(sep)
  .map((part, k) => {
    if (k) {
      return sep + part
    }
    return part
  })

// assuming
// first part is common (setup)
// each other part is a separate describe block that will become its
// own separate spec "file" (except it will be a mock file without a physical file)
const preamble = specParts[0]
const mockSpecs = specParts.slice(1).map((part) => preamble + part)
debug('found %d describe blocks in %s', mockSpecs.length, specFilename)

function mockFilename (k) {
  return path.resolve(`./mock-spec-${k}.js`)
}
config.suites[suiteName] = mockSpecs.map((part, k) => mockFilename(k))
debug('mock suite filenames', config.suites[suiteName])

function isMockSpecFilename (filename) {
  return filename.indexOf('mock-spec') !== -1
}

function findMock (filename) {
  var foundIndex = -1
  config.suites[suiteName].some((name, k) => {
    if (filename === name) {
      foundIndex = k
      return true
    }
  })
  return foundIndex
}

fs.readFileSync = function (filename) {
  if (filename === confFilename) {
    debug('loading config file', filename)
    debug('returning updated config file with mock spec filenames')
    const mockConfigSource = 'exports.config = ' + JSON.stringify(config, null, 2)
    return mockConfigSource
  } else if (filename === specFilename) {
    debug('loading spec file', specFilename)
  }

  if (isMockSpecFilename(filename)) {
    debug('loading mock spec file', filename)
  }
  if (filename.indexOf('node_modules') === -1) {
    debug('file not from node_modules', filename)
  }

  return _readFileSync.apply(null, arguments)
}
