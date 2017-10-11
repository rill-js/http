// @ts-check
/** Type Definitions */
/** @module rill/http */
/** @typedef {(req: IncomingMessage, res: ServerResponse?) => any} RequestHandler */
'use strict'

var Server = require('./server')
var IncomingMessage = require('./incoming-message')
var ServerResponse = require('./server-response')
// @ts-ignore
var STATUS_CODES = require('statuses/codes.json')

module.exports = {
  Server: Server,
  IncomingMessage: IncomingMessage,
  ServerResponse: ServerResponse,
  /** @type {object} */
  STATUS_CODES: STATUS_CODES,
  /** @type {string[]} */
  METHODS: [
    'OPTIONS',
    'HEAD',
    'GET',
    'PUT',
    'POST',
    'PATCH',
    'DELETE'
  ],
  /**
   * Creates a new mock http server in the browser.
   * Any arguments provided (besides the last one) are ignored in the browser.
   *
   * @param {...RequestHandler|{[x: string]: any}} [onRequest] - A function called on each request.
   * @return {Server}
   */
  createServer: function createServer (onRequest) {
    return new Server(arguments[arguments.length - 1])
  }
}
