'use strict'

var assert = require('assert')
var Buffer = require('buffer').Buffer
var http = require('../client')

describe('Response', function () {
  it('should not need options', function () {
    var res = new http.ServerResponse()
    assert(res, 'should have created response')
  })

  describe('#writeContinue, #setTimeout, #addTrailers', function () {
    it('should all be noops', function () {
      var res = new http.ServerResponse()
      res.writeContinue()
      res.setTimeout()
      res.addTrailers()
    })
  })

  describe('#setHeader, #getHeader', function () {
    it('should set and get a header', function () {
      var res = new http.ServerResponse()
      res.setHeader('X-Custom-Header', 'abc')
      assert.equal(res.getHeader('X-Custom-Header'), 'abc', 'should have set header')
    })

    it('should be case insensitive', function () {
      var res = new http.ServerResponse()
      res.setHeader('HEADER-CAPS', 'abc')
      assert.equal(res.getHeader('header-caps'), 'abc', 'should have set header')

      res.setHeader('header-lower', 'abc')
      assert.equal(res.getHeader('HEADER-LOWER'), 'abc', 'should have set header')
    })
  })

  describe('#removeHeader', function () {
    it('should unset a header', function () {
      var res = new http.ServerResponse()
      res.setHeader('X-Custom-Header', 'abc')
      res.removeHeader('X-Custom-Header')
      assert.equal(res.getHeader('X-Custom-Header'), null, 'should have removed the header')
    })
  })

  describe('#writeHead', function () {
    it('should set status', function () {
      var res = new http.ServerResponse()
      res.writeHead(200)

      assert(res.headersSent, 'should have sent headers')
      assert.equal(res.statusCode, 200, 'should have set statusCode')
    })

    it('should set headers and status', function () {
      var res = new http.ServerResponse()
      res.writeHead(200, 'success', {
        'X-Custom-Header': 'hello'
      })

      assert(res.headersSent, 'should have sent headers')
      assert.equal(res.getHeader('X-Custom-Header'), 'hello', 'should have set header')
      assert.equal(res.statusCode, 200, 'should have set statusCode')
      assert.equal(res.statusMessage, 'success', 'should have set statusMessage')
    })

    it('should have optional status message', function () {
      var res = new http.ServerResponse()
      res.writeHead(200, {
        'X-Custom-Header': 'hello'
      })

      assert(res.headersSent, 'should have sent headers')
      assert.equal(res.getHeader('X-Custom-Header'), 'hello', 'should have set header')
      assert.equal(res.statusCode, 200, 'should have set statusCode')
    })

    it('should do nothing if the request is already finished', function (done) {
      var res = new http.ServerResponse()
      res.writeHead(200, 'success', {
        'X-Custom-Header': 'hello'
      })

      res.end(function () {
        res.writeHead(201, 'created', {
          'X-Custom-Header': 'world'
        })
        assert(res.headersSent, 'should have sent headers')
        assert.equal(res.getHeader('X-Custom-Header'), 'hello', 'should have set header')
        assert.equal(res.statusCode, 200, 'should have set statusCode')
        assert.equal(res.statusMessage, 'success', 'should have set statusMessage')
        done()
      })
    })
  })

  describe('#write', function () {
    it('should accept a buffer', function () {
      var res = new http.ServerResponse()
      res.write(Buffer.from(['abc']))
      assert.equal(res._body.length, 1, 'should have written to the body')
    })

    it('should accept a callback', function (done) {
      var res = new http.ServerResponse()
      res.write(Buffer.from(['']), done)
      res.end()
    })
  })

  describe('#end', function () {
    it('should accept a buffer', function () {
      var res = new http.ServerResponse()
      res.write(Buffer.from(['abc']))
      assert.equal(res._body.length, 1, 'should have written to the body')
      res.end(Buffer.from(['efd']))
      assert.equal(res._body.length, 2, 'should have written to the body')
      assert(res.body, 'should have created the final concatinated body')
    })

    it('should finish a response', function (done) {
      var res = new http.ServerResponse()
      var called = 0
      res.once('finish', checkCompleted)
      res.end(checkCompleted)

      function checkCompleted () {
        assert(res.headersSent, 'should have sent headers')
        assert(res.finished, 'should be finished')
        called++
        if (called === 2) done()
      }
    })

    it('should finish a response and accept a buffer', function (done) {
      var res = new http.ServerResponse()
      res.end(Buffer.from(['abc']), checkCompleted)

      function checkCompleted () {
        assert(res.headersSent, 'should have sent headers')
        assert(res.finished, 'should be finished')
        assert.equal(res._body.length, 1, 'should have written to the body')
        assert(res.body, 'should have created the final concatinated body')
        done()
      }
    })

    it('should do nothing if response already finished', function (done) {
      var res = new http.ServerResponse()
      var called = 0
      res.end(checkCompleted)
      res.end(checkCompleted)

      function checkCompleted () {
        assert(res.headersSent, 'should have sent headers')
        assert(res.finished, 'should be finished')
        called++
        if (called === 1) done()
      }
    })
  })

  describe('#sendDate', function () {
    it('should send date header by default', function () {
      var res = new http.ServerResponse()
      res.end()
      assert.ok(res.getHeader('date'), 'should have set date header.')
    })

    it('should be able to disable date header', function () {
      var res = new http.ServerResponse()
      res.sendDate = false
      res.end()
      assert.ok(!res.getHeader('date'), 'should have set date header.')
    })
  })
})
