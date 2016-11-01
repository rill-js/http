'use strict'

var assert = require('assert')
var http = require('../client')

describe('Request', function () {
  it('should populate fields', function () {
    var opts = {
      url: '/',
      method: 'POST',
      body: { hello: 'world' },
      files: { hello: 'again' }
    }
    var req = new http.IncomingMessage(opts)
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
    var req = new http.IncomingMessage(opts)
    assert.equal(req.url, opts.url, 'should have url')
    assert.equal(req.method, 'GET', 'should have method')
  })
})
