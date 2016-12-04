'use strict'

var URL = require('url')
var window = require('global')
var EventEmitter = require('events').EventEmitter
var IncomingMessage = require('./incoming-message')
var ServerResponse = require('./server-response')
var server = Server.prototype = Object.create(EventEmitter.prototype)
var FetchRequest = window.Request
var FetchResponse = window.Response
var FetchHeaders = window.Headers
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
server.fetch = function fetch (path, options) {
  var server = this
  // Create a fetch request object.
  var request = path instanceof FetchRequest ? path : new FetchRequest(path, options)
  // Resolve url and parse out the parts.
  request.url = URL.resolve(location.href, request.url)
  request.parsed = URL.parse(request.url)
  // Attach referrer (stored on each request).
  request.referrer = request.referrer || referrer

  // Create a nodejs style req and res.
  var incommingMessage = IncomingMessage._createIncomingMessage(request, server, options)
  var serverResponse = ServerResponse._createServerResponse(incommingMessage)

  // Return a 'fetch' style response as a promise.
  return new Promise(function (resolve, reject) {
    // Wait for server response to be sent.
    serverResponse.once('finish', function handleResponseEnd () {
      // Marks incomming message as complete.
      incommingMessage.complete = true
      incommingMessage.emit('end')

      // Check to see if we should redirect.
      var redirect = serverResponse.getHeader('location')
      if (redirect) {
        // Follow redirect if needed.
        if (request.redirect === undefined || request.redirect === 'follow') {
          return resolve(server.fetch(redirect))
        }
      } else {
        // Ensure referrer gets updated for non-redirects.
        referrer = request.url
      }

      return resolve(new FetchResponse(Buffer.concat(serverResponse._body).buffer, {
        url: request.url,
        status: serverResponse.statusCode,
        statusText: serverResponse.statusMessage,
        headers: new FetchHeaders(serverResponse._headers)
      }))
    })

    // Trigger request event on server.
    server.emit('request', incommingMessage, serverResponse)
  })
}

module.exports = Server
