'use strict'

var URL = require('url')
var window = require('global')
var EventEmitter = require('events').EventEmitter
var IncomingMessage = require('./incoming-message')
var ServerResponse = require('./server-response')
var server = Server.prototype = Object.create(EventEmitter.prototype)
var referrer = window.document && window.document.referrer
/* istanbul ignore next */
var location = (window.history && window.history.location) || window.location || { href: '' }
// Make the fetch api optional.
/* istanbul ignore next */
var FetchRequest = window.Request || noop
/* istanbul ignore next */
var FetchResponse = window.Response || noop
/* istanbul ignore next */
var FetchHeaders = window.Headers || noop
/* istanbul ignore next */
function noop () {}

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
  if (url instanceof FetchRequest) {
    // Allow for a regular fetch request.
    opts = {
      method: url.method,
      headers: headersToObject(url.headers)
    }
    url = url.url
  } else {
    // Allow for fetch style api.
    url = String(url)
    // Make options optional.
    if (typeof opts !== 'object') opts = {}
    // Default redirect mode to 'follow'
    opts.redirect = opts.redirect || 'follow'
  }

  // Ignore links that don't share a protocol or host with the browsers.
  var href = URL.resolve(location.href, url)
  var parsed = URL.parse(href)

  // Ensure that the url is nodejs like (starts with initial forward slash) but has the hash portion.
  opts.url = parsed.path + (parsed.hash || '')
  // Attach referrer (stored on each request).
  opts.referrer = opts.referrer || referrer
  // Store the parsed url to use later.
  opts._parsed = parsed

  // Create a nodejs style req and res.
  var req = new IncomingMessage(opts, this)
  var res = new ServerResponse(null, this)

  // Store hidden references between request and response.
  req._res = res
  res._req = req

  // Store server
  var self = this

  // Return a 'fetch' style response as a promise.
  return new Promise(function (resolve, reject) {
    // Wait for request to be sent.
    res.once('finish', function handleResponseEnd () {
      // Marks request as complete.
      req.complete = true
      req.emit('end')

      // Check to see if we should redirect.
      var redirect = res.getHeader('location')
      if (redirect) {
        // Redirect the browser on the next tick.
        if (opts.redirect === 'follow') {
          return resolve(self.navigate(redirect))
        }
      } else {
        // Ensure referrer gets updated for non-redirects.
        referrer = req._parsed.href
      }

      return resolve(new FetchResponse(res.body, {
        url: req.url,
        status: res.statusCode,
        statusText: res.statusMessage,
        headers: new FetchHeaders(res.headers)
      }))
    })

    // Trigger request event.
    self.emit('request', req, res)
  })
}

/**
 * Enumerates whatwg fetch headers and turns it into an object.
 */
function headersToObject (headers) {
  var result = {}
  headers.forEach(function (value, header) {
    result[header] = value
  })
  return result
}

module.exports = Server
