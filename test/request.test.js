'use strict'

require('./polyfill')
var URL = require('url')
var assert = require('assert')
var window = require('global')
var http = require('../client')
var FetchRequest = window.Request
/* istanbul ignore next */
var location = (window.history && window.history.location) || window.location || { href: '' }

/**
 * Creates an empty incoming message.
 */
function createIncomingMessage (path, opts) {
  var request = new FetchRequest(path, opts)
  request.url = URL.resolve(location.href, request.url)
  request.parsed = URL.parse(request.url)
  return new http.IncomingMessage._createIncomingMessage(request, {}, opts)
}

describe('Request', function () {
  it('should populate fields', function () {
    var opts = {
      url: '/',
      method: 'POST',
      body: { hello: 'world' },
      files: { hello: 'again' }
    }
    var req = createIncomingMessage(opts.url, opts)
    assert.equal(req.url, opts.url, 'should have url')
    assert.equal(req.method, opts.method, 'should have method')
    assert.deepEqual(req.body, opts.body, 'should have body')
    assert.deepEqual(req.files, opts.files, 'should have files')
    assert(req.connection, 'should have connection')
    assert(req.socket, 'should have socket')
  })

  it('should default method to GET', function () {
    var opts = {
      url: '/'
    }
    var req = createIncomingMessage(opts.url)
    assert.equal(req.url, opts.url, 'should have url')
    assert.equal(req.method, 'GET', 'should have method')
  })
})
