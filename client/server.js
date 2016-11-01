'use strict'

var URL = require('url')
var window = require('global')
var EventEmitter = require('events').EventEmitter
var Request = require('./request.js')
var Response = require('./response.js')
var server = Server.prototype = Object.create(EventEmitter.prototype)
var referrer = window.document && window.document.referrer
/* istanbul ignore next */
var location = (window.history && window.history.location) || window.location || { href: '' }

/**
 * Emulates node js http server in the browser.
 *
 * @param {Function} handler - the handle for a request.
 */
function Server (handler) {
  if (handler) this.on('request', handler)
}

/**
 * Listen to all url change events on a dom element and trigger the server callback.
 */
server.listen = function listen () {
  // Automatically add callback `listen` handler.
  var cb = arguments[arguments.length - 1]
  if (typeof cb === 'function') this.once('listening', cb)

  // Ensure that listening is `async`.
  setTimeout(function () {
    // Mark server as listening.
    this.listening = true
    this.emit('listening')
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
    // Mark server as closed.
    this.listening = false
    this.emit('close')
  }.bind(this), 0)

  return this
}

/*
 * Trigger the registered handle to navigate to a given url.
 *
 * @param {String} url
 * @param {Object} opts
 * @param {Boolean} opts.scroll
 * @api private
 */
server.navigate = function navigate (url, opts) {
  // Cast url to string.
  url = String(url)
  // Make options optional.
  if (typeof opts !== 'object') opts = {}

  // Ignore links that don't share a protocol or host with the browsers.
  var href = URL.resolve(location.href, url)
  var parsed = URL.parse(href)

  // Ensure that the url is nodejs like (starts with initial forward slash) but has the hash portion.
  opts.url = parsed.path + (parsed.hash || '')
  // Attach referrer (stored on each request).
  opts.referrer = referrer
  // Store the parsed url to use later.
  opts._parsed = parsed

  // Create a nodejs style req and res.
  var req = new Request(opts, this)
  var res = new Response(null, this)

  // Wait for request to be sent.
  res.once('finish', function onEnd () {
    // Node marks requests as complete.
    req.complete = true
    req.emit('end')

    // Check to see if we should redirect.
    var redirect = res.getHeader('location')
    if (redirect) {
      // Redirect the browser on the next tick.
      setTimeout(this.navigate.bind(this, redirect), 0)
    } else {
      // Ensure referrer gets updated for non-redirects.
      referrer = href
    }
  }.bind(this))

  this.emit('request', req, res)
  return this
}

module.exports = Server
