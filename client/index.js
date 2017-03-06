'use strict'

var Server = require('./server')
var IncomingMessage = require('./incoming-message')
var ServerResponse = require('./server-response')
var STATUS_CODES = require('statuses/codes.json')
var METHODS = [
  'DELETE',
  'GET',
  'HEAD',
  'OPTIONS',
  'PATCH',
  'POST',
  'PUT'
]

require('../adapter/browser')

module.exports = {
  STATUS_CODES: STATUS_CODES,
  METHODS: METHODS,
  Server: Server,
  IncomingMessage: IncomingMessage,
  ServerResponse: ServerResponse,
  createServer: function createServer () {
    var cb = arguments[arguments.length - 1]
    return new Server(cb)
  }
}
