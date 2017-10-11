// @ts-check
/** Type Definitions */
/** @module rill/http/Server */
/** @typedef {(req: http.IncomingMessage, res: http.ServerResponse?) => any} RequestHandler */
'use strict'

var EventEmitter = require('events-light')
module.exports = Server['default'] = Server

/**
 * Emulates node js http server in the browser.
 *
 * @param {RequestHandler} onRequest - A function called on each request.
 * @constructor
 * @extends EventEmitter
 */
function Server (onRequest) {
  if (onRequest) this.on('request', onRequest)
}

// Extend EventEmitter.
Server.prototype = Object.create(EventEmitter.prototype)

/**
 * Starts a server and sets listening to true.
 * Adapters will hook into this to startup routers on individual platforms.
 *
 * @param {...any} [args] - Arguments beside the onListening function are ignored in the browser.
 * @param {Function} [onListening] - A function that will be called once the server is listening.
 * @return {Server}
 */
Server.prototype.listen = function listen () {
  // Automatically add callback `listen` handler.
  var onListening = arguments[arguments.length - 1]
  if (typeof onListening === 'function') this.once('listening', onListening)

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
 *
 * @param {Function} [onClose] - A function that will be called once the server has closed.
 * @return {Server}
 */
Server.prototype.close = function close (onClose) {
  // Automatically add callback `close` handler.
  if (typeof onClose === 'function') this.once('close', onClose)

  // Ensure that closing is `async`.
  setTimeout(function () {
    // Mark server as closed.
    this.listening = false
    this.emit('close')
  }.bind(this), 0)

  return this
}
