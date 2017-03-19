'use strict'

var EventEmitter = require('events-light')

// Expose module.
module.exports = Server['default'] = Server

/**
 * Emulates node js http server in the browser.
 *
 * @param {Function} [onRequest] - A function that will be called on every request.
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
 * @param {...any}
 * @param {Function} [onListening] - A function that will be called once the server is listening.
 * @return {this}
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
 * @return {this}
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
