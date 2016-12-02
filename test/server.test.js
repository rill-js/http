'use strict'

require('./polyfill')
var assert = require('assert')
var http = require('../client')
var Request = global.Request
var Headers = global.Headers

describe('Server', function () {
  describe('#listen', function () {
    it('should be able to listen and emit events', function (done) {
      var called = 0
      var server = new http.Server()
      server.once('listening', checkCompleted)
      server.listen(checkCompleted)
      function checkCompleted () {
        assert(server.listening, 'server should be listening')
        called++
        if (called === 2) done()
      }
    })

    it('should not need listener function', function (done) {
      var called = 0
      var server = new http.Server()
      server.once('listening', checkCompleted)
      server.listen()
      function checkCompleted () {
        assert(server.listening, 'server should be listening')
        called++
        if (called === 1) done()
      }
    })
  })

  describe('#fetch', function () {
    it('should emit a new request', function (done) {
      var called = 0
      var server = new http.Server(checkCompleted)
      server.once('request', checkCompleted)
      server.listen(function () {
        server.fetch('/test')
      })

      function checkCompleted (req, res) {
        assert(server.listening, 'server should be listening')
        assert(req instanceof http.IncomingMessage, 'should have IncomingMessage')
        assert(res instanceof http.ServerResponse, 'should have ServerResponse')
        called++
        if (called === 2) server.close(done)
      }
    })

    it('should be able to redirect and follow redirect', function (done) {
      var server = new http.Server()
      server.once('request', handleNavigate)
      server.listen(function () {
        server.fetch('/test').then(function (res) {
          assert(res.status, 200)
          assert(res.url, '/redirected')
          server.close(done)
        })
      })

      function handleNavigate (req, res) {
        assert.equal(req.url, '/test', 'should have navigated')
        server.once('request', handleRedirect)
        res.writeHead(302, { location: '/redirected' })
        res.end()
      }

      function handleRedirect (req, res) {
        assert.equal(req.url, '/redirected', 'should have redirected')
        res.end()
      }
    })

    it('should be able to redirect and not follow redirect', function (done) {
      var server = new http.Server()
      server.once('request', handleNavigate)
      server.listen(function () {
        server.fetch('/test', { redirect: 'manual' }).then(function (res) {
          assert(res.status, 200)
          assert(res.url, '/test')
          server.close(done)
        })
      })

      function handleNavigate (req, res) {
        assert.equal(req.url, '/test', 'should have navigated')
        server.once('request', handleRedirect)
        res.writeHead(302, { location: '/redirected' })
        res.end()
      }

      function handleRedirect (req, res) {
        assert(false, 'should not have redirected')
      }
    })

    it('should accept a fetch request', function (done) {
      var server = new http.Server(checkCompleted)
      server.listen(function () {
        server.fetch(new Request('/test', {
          method: 'POST',
          referrer: 'http://google.ca',
          headers: new Headers({
            a: 1,
            b: 2
          })
        }))
      })

      function checkCompleted (req, res) {
        assert(server.listening, 'server should be listening')
        assert(req instanceof http.IncomingMessage, 'should have IncomingMessage')
        assert(res instanceof http.ServerResponse, 'should have ServerResponse')
        assert(req.url, '/test', 'should have proper url')
        assert(req.headers['a'], '1', 'should have copied headers')
        assert(req.headers['b'], '2', 'should have copied headers')
        server.close(done)
      }
    })
  })

  describe('#close', function () {
    it('should be able to close and emit events', function (done) {
      var called = 0
      var server = new http.Server()
      server.once('close', checkCompleted)
      server.close(checkCompleted)
      function checkCompleted () {
        assert(!server.listening, 'server should not be listening')
        called++
        if (called === 2) done()
      }
    })

    it('should have closing function be optional', function (done) {
      var server = new http.Server()
      server.once('close', checkCompleted)
      server.close()
      function checkCompleted () {
        assert(!server.listening, 'server should not be listening')
        done()
      }
    })
  })
})
