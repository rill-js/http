'use strict'

var Server = require('./server')
var IncomingMessage = require('./incoming-message')
var ServerResponse = require('./server-response')
var STATUS_CODES = require('statuses/codes.json')

/** @type {object} */
exports.STATUS_CODES = STATUS_CODES

/** @type {string[]} */
exports.METHODS = [
  'OPTIONS',
  'HEAD',
  'GET',
  'PUT',
  'POST',
  'PATCH',
  'DELETE'
]

/** @type {Server} */
exports.Server = Server

/** @type {IncomingMessage} */
exports.IncomingMessage = IncomingMessage

/** @type {ServerResponse} */
exports.ServerResponse = ServerResponse

/**
 * Creates a new mock http server in the browser.
 *
 * @return {Server}
 */
exports.createServer = function () {
  var onRequest = arguments[arguments.length - 1]
  return new Server(onRequest)
}
