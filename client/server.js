'use strict'

var URL = require('url')
var EventEmitter = require('events').EventEmitter
var handlers = require('./handlers')
var Request = require('./request.js')
var Response = require('./response.js')
var history = window.history
var location = history.location || window.location
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
  var cb = arguments[arguments.length - 1]
  this._onPopState = handlers.onPopState.bind(this)
  this._onSubmit = handlers.onSubmit.bind(this)
  this._onClick = handlers.onClick.bind(this)

  window.addEventListener('DOMContentLoaded', this._onPopState)
  window.addEventListener('popstate', this._onPopState)
  window.addEventListener('submit', this._onSubmit)
  window.addEventListener('click', this._onClick)

  if (typeof cb === 'function') setTimeout(cb, 0)
  return this
}

/**
 * Closes the server and destroys all event listeners.
 */
server.close = function close () {
  var cb = arguments[arguments.length - 1]

  window.removeEventListener('DOMContentLoaded', this._onPopState)
  window.removeEventListener('popstate', this._onPopState)
  window.removeEventListener('submit', this._onSubmit)
  window.removeEventListener('click', this._onClick)

  if (typeof cb === 'function') setTimeout(cb, 0)
  this.emit('close')
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
  if (typeof opts !== 'object') opts = {}
  // Allow navigation with url only.
  if (typeof req === 'string') req = { url: req }

  // Ignore links that don't share a protocol or host with the browsers.
  var parsed = URL.parse(URL.resolve(location.href, req.url))
  if (parsed.host !== location.host) return false
  if (parsed.protocol !== location.protocol) return false

  req.url = parsed.path + (parsed.hash || '')
  req.referrer = referrer
  req = new Request(req)
  var res = new Response()

  res.once('finish', function onEnd () {
    req.complete = true
    req.emit('end')

    // Any navigation during a 'refresh' will cancel the refresh.
    clearTimeout(this._pending_refresh)

    // Check if we should set some cookies.
    if (res.getHeader('set-cookie')) {
      var cookies = res.getHeader('set-cookie')
      if (cookies.constructor !== Array) cookies = [cookies]
      cookies.forEach(function (cookie) { document.cookie = cookie })
    }

    // Check to see if a refresh was requested.
    if (res.getHeader('refresh')) {
      var parts = res.getHeader('refresh').split(' url=')
      var timeout = parseInt(parts[0]) * 1000
      var redirectURL = parts[1]
      // This handles refresh headers similar to browsers.
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

    // Check to see if we shouldn't update the url.
    if (opts.popState || req.method !== 'GET' || req.headers.referer === req.url) return

    /*
     * When navigating a user will be brought to the top of the page.
     * If the urls contains a hash that is the id of an element (a target) then the target will be scrolled to.
     * This is similar to how browsers handle page transitions natively.
     */
    var hash = req.url.match(/#(.+)$/)
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

    // Update the href in the browser.
    history.pushState(null, document.title, req.url)
  }.bind(this))

  this.emit('request', req, res)
  return this
}

module.exports = Server
