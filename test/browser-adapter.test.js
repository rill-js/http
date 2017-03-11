'use strict'

require('./polyfill')
var window = require('global')
var URL = require('url')
var assert = require('assert')
var http = require('../client')
var adapter = require('../adapter/browser')
var fetch = adapter.fetch
var Request = global.Request
var location = window.history.location || window.location

describe('Adapter/Browser', function () {
  before(function () {
    window.addEventListener('beforeunload', preventNavigation, false)
    window.addEventListener('unload', preventNavigation, false)
  })

  after(function () {
    window.removeEventListener('beforeunload', preventNavigation)
    window.removeEventListener('unload', preventNavigation)
  })

  function preventNavigation () {
    var originalHashValue = location.hash

    window.setTimeout(function () {
      location.hash = 'preventNavigation' + ~~(9999 * Math.random())
      location.hash = originalHashValue
    }, 0)
  }

  describe('cookies', function () {
    var server = adapter(http.createServer(), false)
    before(function (done) {
      server.listen(done)
    })
    after(function (done) { server.close(done) })

    // Clear existing cookies.
    if (document.cookie) {
      document.cookie
        .split(';')
        .forEach(function (c) {
          document.cookie = c
            .replace(/^ +/, '')
            .replace(/ +$/, '')
            .replace(/=.*/, '=;expires=Thu, 01 Jan 1970 00:00:00 GMT')
        })
    }

    it('should set a single cookie', function () {
      server.once('request', function (req, res) {
        res.setHeader('set-cookie', 'x=1')
        res.end()
      })

      return fetch(server, { url: '/test', method: 'POST' }).then(function () {
        assert.equal(document.cookie, 'x=1', 'should have set cookie')
      })
    })

    it('should set a multiple cookies', function () {
      server.once('request', function (req, res) {
        res.setHeader('set-cookie', ['x=1', 'y=2'])
        res.end()
      })
      return fetch(server, { url: '/test', method: 'POST' }).then(function () {
        assert.equal(document.cookie, 'x=1; y=2', 'should have set cookie')
      })
    })
  })

  describe('initialize', function () {
    var server = adapter(http.createServer())
    before(function () {
      server.listen()
    })
    after(function (done) { server.close(done) })

    it('should trigger a request on load', function (done) {
      server.once('request', handleLoad)

      function handleLoad (req, res) {
        done()
      }
    })
  })

  describe('refresh', function () {
    var server = adapter(http.createServer(), false)
    before(function (done) {
      server.listen(done)
    })
    after(function (done) { server.close(done) })

    it('should trigger a fake browser refresh on refresh links', function (done) {
      this.timeout(3000)
      var start
      server.once('request', handleNavigate)
      fetch(server, { url: '/test' })

      function handleNavigate (req, res) {
        start = new Date()
        assert.equal(req.url, '/test', 'should have navigated')
        server.once('request', handleRedirect)
        res.writeHead(302, { refresh: '1; url=/redirected' })
        res.end()
      }

      function handleRedirect (req, res) {
        var delta = new Date() - start
        assert(delta >= 700, 'should be 1000ms later')
        assert(delta < 2500, 'should be 1000ms later')
        assert.equal(req.url, '/redirected', 'should have redirected')
        res.end(done)
      }
    })
  })

  describe('back', function () {
    var server = adapter(http.createServer(), false)
    before(function (done) {
      server.listen(done)
    })
    after(function (done) { server.close(done) })

    it('should handle popstate', function (done) {
      server.once('request', function (req, res) {
        assert.equal(req.url, location.pathname, 'should have triggered back button')
        done()
      })

      window.history.pushState(null, '', location.href)
      window.history.back()
    })
  })

  describe('<a> click', function () {
    var server = adapter(http.createServer(function (req, res) { res.end() }), false)
    before(function (done) {
      server.listen(done)
    })
    after(function (done) { server.close(done) })

    it('should handle internal links', function (done) {
      var testURL = '/test-internal-link'
      var el = createEl('a', { href: testURL })

      once('click', el, function (e) {
        assert.ok(e.defaultPrevented)
        el.parentNode.removeChild(el)
        done()
      })

      clickEl(el)
    })

    it('should handle internal links with hashes', function (done) {
      var testURL = '/test-internal-link#test'
      var el = createEl('a', { href: testURL })

      once('click', el, function (e) {
        assert.ok(e.defaultPrevented)
        el.parentNode.removeChild(el)
        done()
      })

      clickEl(el)
    })

    it('should handle internal links with hashes (scroll to element)', function (done) {
      var testURL = '/test-internal-link#test'
      var el = createEl('a', { href: testURL })
      var div = createEl('div', { id: 'test' })

      once('click', el, function (e) {
        assert.ok(e.defaultPrevented)
        el.parentNode.removeChild(el)
        div.parentNode.removeChild(div)
        done()
      })

      clickEl(el)
    })

    it('should handle internal links (child element)', function (done) {
      var testURL = '/test-internal-link'
      var el = createEl('a', { href: testURL })
      var span = document.createElement('span')
      el.appendChild(span)

      once('click', span, function (e) {
        assert.ok(e.defaultPrevented)
        el.parentNode.removeChild(el)
        done()
      })

      clickEl(span)
    })

    it('should ignore non links', function (done) {
      var el = createEl('span')

      once('click', el, function (e) {
        assert.ok(!e.defaultPrevented)
        el.parentNode.removeChild(el)
        done()
      })

      clickEl(el)
    })

    it('should ignore default prevented clicks', function (done) {
      var testURL = '/test-default-prevented-link'
      var el = createEl('a', { href: testURL })

      el.addEventListener('click', function (e) { e.preventDefault() })
      once('click', el, function (e) {
        assert.ok(e.defaultPrevented)
        el.parentNode.removeChild(el)
        done()
      })

      clickEl(el)
    })

    it('should ignore links without an href', function (done) {
      var el = createEl('a', {})

      once('click', el, function (e) {
        assert.ok(!e.defaultPrevented)
        done()
      })

      clickEl(el)
    })

    it('should ignore rel external links', function (done) {
      var el = createEl('a', { href: '/', rel: 'external' })

      once('click', el, function (e) {
        assert.ok(!e.defaultPrevented)
        el.parentNode.removeChild(el)
        done()
      })

      clickEl(el)
    })

    it('should ignore target links', function (done) {
      var el = createEl('a', { href: '/', target: '_blank' })

      once('click', el, function (e) {
        assert.ok(!e.defaultPrevented)
        el.parentNode.removeChild(el)
        done()
      })

      clickEl(el)
    })

    it('should ignore different protocol links', function (done) {
      var el = createEl('a', { href: 'https://' + location.host + '/test' })

      once('click', el, function (e) {
        assert.ok(!e.defaultPrevented)
        el.parentNode.removeChild(el)
        done()
      })

      clickEl(el)
    })

    it('should ignore links with a different host', function (done) {
      var el = createEl('a', { href: 'http://google.ca' })

      once('click', el, function (e) {
        assert.ok(!e.defaultPrevented)
        el.parentNode.removeChild(el)
        done()
      })

      clickEl(el)
    })

    it('should ignore links with a download attribute', function (done) {
      var el = createEl('a', { href: '/test', download: 'test.file' })

      once('click', el, function (e) {
        assert.ok(!e.defaultPrevented)
        el.parentNode.removeChild(el)
        done()
      })

      clickEl(el)
    })
  })

  describe('<form> submit', function () {
    var formData
    var formURL
    var server

    beforeEach(function (done) {
      server = adapter(http.createServer(function (req, res) {
        formData = req.body
        formURL = req.url
        res.end()
      }), false).listen(done)
    })
    afterEach(function (done) {
      formData = formURL = undefined
      server.close(done)
    })

    it('should handle internal body forms', function (done) {
      var testURL = '/test-internal-post-form'
      var el = createEl('form', { action: testURL, method: 'POST' })
      var input = createEl('input', { name: 'test', value: '1' })
      var submit = createEl('button', { type: 'submit' })
      el.appendChild(input)
      el.appendChild(submit)

      once('submit', el, function (e) {
        assert.ok(e.defaultPrevented)
        assert.ok(formData.test)
        el.parentNode.removeChild(el)
        done()
      })

      clickEl(submit)
    })

    it('should handle internal GET forms with querystring', function (done) {
      var testURL = '/test-internal-get-form'
      var el = createEl('form', { action: testURL, method: 'GET' })
      var input = createEl('input', { name: 'test', value: '1' })
      var submit = createEl('button', { type: 'submit' })
      el.appendChild(input)
      el.appendChild(submit)

      once('submit', el, function (e) {
        assert.ok(e.defaultPrevented)
        var query = URL.parse(formURL, true).query
        assert.equal(query.test, 1)
        el.parentNode.removeChild(el)
        done()
      })

      clickEl(submit)
    })

    it('should ignore default prevented submits', function (done) {
      var testURL = '/test-default-prevented-form'
      var el = createEl('form', { action: testURL, method: 'POST' })
      var input = createEl('input', { name: 'test', value: '1' })
      var submit = createEl('button', { type: 'submit' })
      el.appendChild(input)
      el.appendChild(submit)

      el.addEventListener('submit', function (e) { e.preventDefault() })
      once('submit', el, function (e) {
        assert.ok(e.defaultPrevented)
        assert.equal(formData, undefined)
        el.parentNode.removeChild(el)
        done()
      })

      clickEl(submit)
    })

    it('should ignore target forms', function (done) {
      var testURL = '/test-invalid-target-form'
      var el = createEl('form', { action: testURL, method: 'POST', target: '_blank' })
      var input = createEl('input', { name: 'test', value: '1' })
      var submit = createEl('button', { type: 'submit' })
      el.appendChild(input)
      el.appendChild(submit)

      once('submit', el, function (e) {
        assert.ok(!e.defaultPrevented)
        assert.equal(formData, undefined)
        el.parentNode.removeChild(el)
        done()
      })

      clickEl(submit)
    })

    it('should ignore different protocol forms', function (done) {
      var el = createEl('form', { action: 'https://' + location.host + '/test', method: 'POST' })
      var input = createEl('input', { name: 'test', value: '1' })
      var submit = createEl('button', { type: 'submit' })
      el.appendChild(input)
      el.appendChild(submit)

      once('submit', el, function (e) {
        assert.ok(!e.defaultPrevented)
        assert.equal(formData, undefined)
        el.parentNode.removeChild(el)
        done()
      })

      clickEl(submit)
    })

    it('should ignore links with a different host', function (done) {
      var el = createEl('form', { action: 'http://google.ca', method: 'POST' })
      var input = createEl('input', { name: 'test', value: '1' })
      var submit = createEl('button', { type: 'submit' })
      el.appendChild(input)
      el.appendChild(submit)

      once('submit', el, function (e) {
        assert.ok(!e.defaultPrevented)
        assert.equal(formData, undefined)
        el.parentNode.removeChild(el)
        done()
      })

      clickEl(submit)
    })
  })

  describe('#fetch', function () {
    it('should fail with invalid options', function (done) {
      var server = new http.Server()
      fetch(server, 1).catch(function (err) {
        assert.equal(err.name, 'TypeError')
        fetch(server, {}).catch(function (err) {
          assert.equal(err.name, 'TypeError')
          done()
        })
      })
    })

    it('should emit a new request', function (done) {
      var called = 0
      var server = new http.Server(checkCompleted)
      server.once('request', checkCompleted)
      server.listen(function () {
        fetch(server, { url: '/test' })
      })

      function checkCompleted (req, res) {
        assert(server.listening, 'server should be listening')
        assert(req instanceof http.IncomingMessage, 'should have IncomingMessage')
        assert(res instanceof http.ServerResponse, 'should have ServerResponse')
        called++
        if (called === 2) server.close(done)
      }
    })

    it('should pass through body option', function (done) {
      var startup = true
      var server = new http.Server(checkCompleted)
      server.once('request', checkCompleted)
      server.listen(function () {
        fetch(server, { url: '/test', method: 'POST', body: { a: 1 } })
      })

      function checkCompleted (req, res) {
        if (startup) {
          startup = false
          return
        }

        assert.deepEqual(req.body, { a: 1 }, 'should have passed through body')
        done()
      }
    })

    it('should be able to redirect and follow redirect', function (done) {
      var server = new http.Server()
      server.once('request', handleNavigate)
      server.listen(function () {
        fetch(server, { url: '/test' }).then(function (data) {
          var res = data[1]
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
        fetch(server, { url: '/test', redirect: 'manual' }).then(function (data) {
          var res = data[1]
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
        fetch(server, new Request('/test', {
          method: 'POST',
          headers: {
            a: 1,
            b: 2
          }
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
})

/**
 * Creates an element and attaches it to the dom.
 */
function createEl (tag, attrs) {
  var el = document.createElement(tag)
  for (var name in attrs) el.setAttribute(name, attrs[name])
  document.body.appendChild(el)
  return el
}

/**
 * Triggers a fake click event.
 */
function clickEl (el) {
  setTimeout(function () {
    var ev = document.createEvent('MouseEvent')
    ev.initMouseEvent('click', true, true, window, null, 0, 0, 0, 0, false, false, false, false, 0, null)
    el.dispatchEvent(ev)
  }, 16)
}

/**
 * Adds an event listener for on event and ensures the default is prevented.
 */
function once (type, el, fn) {
  window.addEventListener(type, function prevent (e) {
    if (e.target === el) {
      fn(e)
      e.defaultPrevented || e.preventDefault()
    }
    window.removeEventListener(type, prevent)
  }, false)
}
