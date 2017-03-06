'use strict'

var EventEmitter = require('events').EventEmitter
var proto = IncomingMessage.prototype = Object.create(EventEmitter.prototype)

IncomingMessage._createIncomingMessage = createIncomingMessage
module.exports = IncomingMessage

/**
 * Emulates nodes IncomingMessage in the browser.
 * See: https://nodejs.org/api/http.html#http_class_http_incomingmessage
 */
function IncomingMessage (socket) {
  this.headers = {}
  this.socket = this.connection = socket
}

// Defaults
proto.httpVersionMajor = 1
proto.httpVersionMinor = 1
proto.httpVersion = proto.httpVersionMajor + '.' + proto.httpVersionMinor
proto.complete = false
proto.url = ''

/**
 * Creates a new incoming request and sets up some headers and other properties.
 */
function createIncomingMessage (request, server, options) {
  var incommingMessage = new IncomingMessage({
    server: server,
    remoteAddress: '127.0.0.1',
    encrypted: request.parsed.protocol === 'https:'
  })
  var parsed = request.parsed
  var headers = incommingMessage.headers

  // Set default headers.
  headers['referer'] = headers['referer'] || headers['referrer']
  headers['date'] = (new Date()).toUTCString()
  headers['host'] = parsed.host
  headers['cookie'] = document.cookie
  headers['user-agent'] = navigator.userAgent
  headers['accept-language'] = navigator.language
  headers['connection'] = 'keep-alive'
  headers['cache-control'] = 'max-age=0'
  headers['accept'] = '*/*'

  // Attach headers from request.
  request.headers.forEach(function (value, header) {
    headers[header] = value
  })

  // Setup other properties.
  incommingMessage.url = parsed.pathname + parsed.search + parsed.hash
  incommingMessage.method = request.method
  incommingMessage._request = request

  // Forward some special options.
  if (options) {
    if (options.form) {
      incommingMessage.body = options.form.body
      incommingMessage.files = options.form.files
    }
    incommingMessage._scroll = options.scroll
    incommingMessage._history = options.history
  }

  return incommingMessage
}
