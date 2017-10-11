// @ts-check
/** Type Definitions */
/** @module rill/http/IncomingMessage */
/** @typedef {{ server: http.Server, remoteAddress: string, encrypted: boolean }} Socket */
/** @typedef {{ referrer?: string, referer?: string?, date?: string, host?: string, cookie?: string, 'user-agent'?: string, 'accept-language'?: string, connection?: string, 'cache-control'?: string, accept?: string, [x]: string|string[] }} Headers */
/**
 * @typedef {object} FetchOptions
 * @property {string} [url] - The url to fetch.
 * @property {string} [method='GET'] - The http method to use.
 * @property {HTMLFormElement} [form] - A form element to submit as the body.
 * @property {object} [query] - A request query to add to the url.
 * @property {object} [body] - A request body to pass through as is.
 * @property {object} [files] - An object with files to add to the request body.
 * @property {boolean} [scroll] - Should the request trigger a page scroll.
 * @property {boolean} [history] - Should the request update the page url.
 * @property {string|false} [redirect='follow'] - Should we follow any redirects.
 * @property {object} [parsed] - A parsed URL for the request.
 */
'use strict'

var EventEmitter = require('events-light')
module.exports = IncomingMessage['default'] = IncomingMessage

/**
 * Emulates nodes IncomingMessage in the browser.
 * See: https://nodejs.org/api/http.html#http_class_http_incomingmessage
 *
 * @param {Socket} socket - An emulated node socket.
 * @constructor
 * @extends EventEmitter
 */
function IncomingMessage (socket) {
  this.socket = this.connection = socket
  /** @type {number} */
  this.httpVersionMajor = 1
  /** @type {number} */
  this.httpVersionMinor = 1
  /** @type {string} */
  this.httpVersion = this.httpVersionMajor + '.' + this.httpVersionMinor
  /** @type {boolean} */
  this.complete = false
  /** @type {string} */
  this.url = ''
  /** @type {Headers} */
  this.headers = {}
  /** @type {string} */
  this.method = 'GET'
  /** @type {FetchOptions?} */
  this._options = undefined
}

// Extend EventEmitter.
IncomingMessage.prototype = Object.create(EventEmitter.prototype)

/**
 * Creates a new incoming request and sets up some headers and other properties.
 *
 * @static
 * @param {http.Server} server - The http server to create a request for.
 * @param {object} options - Options for the request.
 * @return {IncomingMessage}
 */
IncomingMessage._createIncomingMessage = function createIncomingMessage (server, options) {
  var parsed = options.parsed
  var incomingMessage = new IncomingMessage({
    server: server,
    remoteAddress: '127.0.0.1',
    encrypted: parsed.protocol === 'https:'
  })

  // Set default headers.
  var headers = incomingMessage.headers
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
  incomingMessage.method = options.method ? options.method.toUpperCase() : 'GET'
  incomingMessage._options = options

  return incomingMessage
}

/**
 * Converts a headers object to a regular object.
 *
 * @param {any} headers - The headers to normalize.
 * @return {Headers}
 */
function normalizeHeaders (headers) {
  if (headers == null || typeof headers.forEach !== 'function') return headers
  var result = {}
  headers.forEach(function (value, header) { result[header] = value })
  return result
}
