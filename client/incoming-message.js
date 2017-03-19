'use strict'

var EventEmitter = require('events-light')

// Expose module.
IncomingMessage._createIncomingMessage = createIncomingMessage
module.exports = IncomingMessage['default'] = IncomingMessage

/**
 * Emulates nodes IncomingMessage in the browser.
 * See: https://nodejs.org/api/http.html#http_class_http_incomingmessage
 *
 * @param {net.Socket} socket - An emulated node socket.
 * @constructor
 */
function IncomingMessage (socket) {
  this.headers = {}
  this.socket = this.connection = socket
}

// Extend EventEmitter.
IncomingMessage.prototype = Object.create(EventEmitter.prototype)

// Static properties and type definitions.
/** @type {number} */
IncomingMessage.prototype.httpVersionMajor = 1

/** @type {number} */
IncomingMessage.prototype.httpVersionMinor = 1

/** @type {string} */
IncomingMessage.prototype.httpVersion = IncomingMessage.prototype.httpVersionMajor + '.' + IncomingMessage.prototype.httpVersionMinor

/** @type {boolean} */
IncomingMessage.prototype.complete = false

/** @type {string} */
IncomingMessage.prototype.url = ''

/** @type {object} */
IncomingMessage.prototype.headers = {}

/** @type {string} */
IncomingMessage.prototype.method = 'GET'

/**
 * Creates a new incoming request and sets up some headers and other properties.
 *
 * @param {http.Server} server - The http server to create a request for.
 * @param {object} options - Options for the request.
 * @return {IncomingMessage}
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
  var reqHeaders = normalizeHeaders(options.headers)
  for (var header in reqHeaders) headers[header] = reqHeaders[header]

  // Setup other properties.
  incommingMessage.method = options.method ? options.method.toUpperCase() : 'GET'
  incommingMessage._options = options

  return incommingMessage
}

/**
 * Converts a headers object to a regular object.
 *
 * @param {object} headers - The headers to normalize.
 * @return {object}
 */
function normalizeHeaders (headers) {
  if (headers == null || typeof headers.forEach !== 'function') return headers
  var result = {}
  headers.forEach(function (value, header) { result[header] = value })
  return result
}
