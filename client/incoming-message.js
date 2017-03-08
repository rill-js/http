'use strict'

var EventEmitter = require('events-light')
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
function createIncomingMessage (server, options) {
  var parsed = options.parsed
  var incommingMessage = new IncomingMessage({
    server: server,
    remoteAddress: '127.0.0.1',
    encrypted: parsed.protocol === 'https:'
  })

  // Set default headers.
  var headers = incommingMessage.headers
  headers['referer'] = headers['referer'] || headers['referrer']
  headers['date'] = (new Date()).toUTCString()
  headers['host'] = parsed.host
  headers['cookie'] = document.cookie
  headers['user-agent'] = navigator.userAgent
  headers['accept-language'] = navigator.language
  headers['connection'] = 'keep-alive'
  headers['cache-control'] = 'max-age=0'
  headers['accept'] = '*/*'

  // Attach headers from request
  var reqHeaders = toHeaders(options.headers)
  for (var header in reqHeaders) {
    headers[header] = reqHeaders[header]
  }

  // Setup other properties.
  incommingMessage.method = options.method
  incommingMessage._options = options

  return incommingMessage
}

/**
 * Converts a headers object to a regular object.
 */
function toHeaders (headers) {
  if (headers == null || typeof headers.forEach !== 'function') return headers
  var result = {}
  headers.forEach(function (value, header) { result[header] = value })
  return result
}
