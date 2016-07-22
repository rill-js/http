'use strict'

var URL = require('url')
var EventEmitter = require('events').EventEmitter
var handlers = require('./handlers')
var Request = require('./request.js')
var Response = require('./response.js')
var history = window.history
var location = history.location || window.location
var hashReg = /#(.+)$/
var server = Server.prototype = Object.create(EventEmitter.prototype)
var referrer

/**
 * Emulates node js http server in the browser.
 *
 * @param {Function} handle - the handle for a request.
 */
function Server (handler) {
  this._handle = this
  this._pending_refresh = null
  if (handler) {
    if (typeof handler !== 'function') {
      throw new TypeError('listener must be a function')
    }
    this.on('request', handler)
  }
}

/**
 * Listen to all url change events on a dom element and trigger the server callback.
 */
server.listen = function listen () {
  // Automatically add callback `listen` handler.
  var cb = arguments[arguments.length - 1]
  if (typeof cb === 'function') this.once('listening', cb)

  // Setup link/form hijackers.
  this._onPopState = handlers.onPopState.bind(this)
  this._onSubmit = handlers.onSubmit.bind(this)
  this._onClick = handlers.onClick.bind(this)

  // Setup initial load event and treat it as popstate.
  this.once('listening', this._onPopState)

  // Ensure that listening is `async`.
  setTimeout(function () {
    // Mark server as listening.
    this.listening = true
    this.emit('listening')
    // Register link/form hijackers.
    window.addEventListener('popstate', this._onPopState)
    window.addEventListener('submit', this._onSubmit)
    window.addEventListener('click', this._onClick)
  }.bind(this), 0)

  return this
}

/**
 * Closes the server and destroys all event listeners.
 */
server.close = function close () {
  // Automatically add callback `close` handler.
  var cb = arguments[arguments.length - 1]
  if (typeof cb === 'function') this.once('close', cb)

  // Ensure that closing is `async`.
  setTimeout(function () {
    // Unregister link/form hijackers.
    window.removeEventListener('popstate', this._onPopState)
    window.removeEventListener('submit', this._onSubmit)
    window.removeEventListener('click', this._onClick)
    // Mark server as closed.
    this.listening = false
    this.emit('close')
  }.bind(this), 0)

  return this
}

/*
 * Trigger the registered handle to navigate to a given url.
 *
 * @param {String|Object} req
 * @param {Object} opts
 * @param {Boolean} opts.popState
 * @api private
 */
server.navigate = function navigate (req, opts) {
  // Make options optional.
  if (typeof opts !== 'object') opts = {}
  // Allow navigation with url only.
  if (typeof req === 'string') req = { url: req }

  // Ignore links that don't share a protocol or host with the browsers.
  var parsed = URL.parse(URL.resolve(location.href, req.url))
  // Ignore links for different hosts.
  if (parsed.host !== location.host) return false
  // Ignore links with a different protocol.
  if (parsed.protocol !== location.protocol) return false

  // Ensure that the url is nodejs like (starts with initial forward slash) but has the hash portion.
  req.url = parsed.path + (parsed.hash || '')
  // Attach referrer (stored on each request).
  req.referrer = referrer
  // Create a nodejs style req and res.
  req = new Request(req)
  var res = new Response()

  // Wait for request to be sent.
  res.once('finish', function onEnd () {
    // Node marks requests as complete.
    req.complete = true
    req.emit('end')

    // Any navigation during a 'refresh' will cancel the refresh.
    clearTimeout(this._pending_refresh)

    // Check if we should set some cookies.
    if (res.getHeader('set-cookie')) {
      var cookies = res.getHeader('set-cookie')
      if (Array.isArray(cookies)) {
        // Set multiple cookie header.
        cookies.forEach(function (cookie) { document.cookie = cookie })
      } else {
        // Set a single cookie.
        document.cookie = cookies
      }
    }

    // Check to see if a refresh was requested.
    if (res.getHeader('refresh')) {
      var parts = res.getHeader('refresh').split(' url=')
      var timeout = parseInt(parts[0]) * 1000
      var redirectURL = parts[1]
      // This handles refresh headers similar to browsers by waiting a timeout, then navigating.
      this._pending_refresh = setTimeout(
        this.navigate.bind(this, redirectURL),
        timeout
      )
    }

    // Check to see if we should redirect.
    if (res.getHeader('location')) {
      setTimeout(this.navigate.bind(this, res.getHeader('location')), 0)
      return
    }

    // Ensure referrer gets updated for non-redirects.
    referrer = req.url

    // We don't do hash scrolling unless it is a get request.
    if (req.method !== 'GET') return

    // popstate state is handled by the browser.
    if (opts.popState) return

    /*
     * When navigating a user will be brought to the top of the page.
     * If the urls contains a hash that is the id of an element (a target) then the target will be scrolled to.
     * This is similar to how browsers handle page transitions natively.
     */
    var hash = req.url.match(hashReg)
    if (hash == null) window.scrollTo(0, 0)
    else {
      var target = document.getElementById(hash[1])
      if (target) {
        target.scrollIntoView({
          block: 'start',
          behavior: 'smooth'
        })
      }
    }

    // Don't push the same url twice.
    if (req.headers.referer === req.url) return

    // Update the href in the browser.
    history.pushState(null, document.title, req.url)
  }.bind(this))

  this.emit('request', req, res)
  return this
}

module.exports = Server
