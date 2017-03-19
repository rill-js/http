'use strict'

var EventEmitter = require('events-light')
var STATUS_CODES = require('statuses/codes.json')

// Expose module.
ServerResponse._createServerResponse = createServerResponse
module.exports = ServerResponse['default'] = ServerResponse

/**
 * Emulates nodes ServerResponse in the browser.
 * See: https://nodejs.org/api/http.html#http_class_http_serverresponse
 *
 * @param {IncomingMessage} incomingMessage - The request to the server.
 * @constructor
 */
function ServerResponse (incomingMessage) {
  this._headers = {}
  this.socket = this.connection = incomingMessage.socket
}

// Extend EventEmitter.
ServerResponse.prototype = Object.create(EventEmitter.prototype)

// Static properties and type definitions.
/** @type {number} */
ServerResponse.prototype.statusCode = null

/** @type {string} */
ServerResponse.prototype.statusMessage = null

/** @type {boolean} */
ServerResponse.prototype.sendDate = true

/** @type {boolean} */
ServerResponse.prototype.finished = false

/** @type {boolean} */
ServerResponse.prototype.headersSent = false

/** @type {Function} */
ServerResponse.prototype.writeContinue =

/** @type {Function} */
ServerResponse.prototype.setTimeout =

/** @type {Function} */
ServerResponse.prototype.addTrailers = function () {}

/**
 * Writes data to the current ServerResponse body.
 *
 * @param {Buffer|ArrayBuffer|string[]} chunk - The chunk of data to write.
 * @param {string} [encoding] - The encoding for the chunk.
 * @param {Function} [onFinish] - A function that will be called when the response has finished.
 */
ServerResponse.prototype.write = function (chunk, encoding, onFinish) {
  this._body.push(chunk)

  if (typeof encoding === 'function') {
    onFinish = encoding
    encoding = null
  }

  if (typeof onFinish === 'function') {
    this.once('finish', onFinish)
  }
}

/**
 * Write status, status message and headers to the current ServerResponse.
 *
 * @param {number} [statusCode] - The status code to write.
 * @param {string} [string] - The status message to write.
 * @param {object} [headers] - An object containing headers to write.
 */
ServerResponse.prototype.writeHead = function writeHead (statusCode, statusMessage, headers) {
  if (this.finished) return

  this.statusCode = statusCode
  this.headersSent = true
  if (statusMessage) {
    if (typeof statusMessage === 'object') {
      headers = statusMessage
    } else {
      this.statusMessage = statusMessage
    }
  }

  if (typeof headers === 'object') {
    for (var key in headers) {
      this.setHeader(key, headers[key])
    }
  }
}

/**
 * Get a shallow copy of all response header names.
 *
 * @return {object}
 */
ServerResponse.prototype.getHeaders = function getHeaders () {
  var clone = {}
  for (var key in this._headers) clone[key] = this._headers[key]
  return clone
}

/**
 * Get a list of current header names.
 *
 * @return {string[]}
 */
ServerResponse.prototype.getHeaderNames = function getHeaderNames () {
  return Object.keys(this._headers)
}

/**
 * Get a header from the current ServerResponse.
 *
 * @param {string} header - The name of the header to get.
 * @return {string[]|string|void}
 */
ServerResponse.prototype.getHeader = function getHeader (header) {
  return this._headers[header.toLowerCase()]
}

/**
 * Check if a header has been set.
 *
 * @param {string} header - The name of the header to check.
 * @return {boolean}
 */
ServerResponse.prototype.hasHeader = function hasHeader (header) {
  return header.toLowerCase() in this._headers
}

/**
 * Remove a header from the current ServerResponse.
 */
ServerResponse.prototype.removeHeader = function removeHeader (header) {
  delete this._headers[header.toLowerCase()]
}

/**
 * Write a header to the current ServerResponse.
 *
 * @param {string} header - The name of the header to set.
 * @param {string[]|string} - The value for the header.
 */
ServerResponse.prototype.setHeader = function setHeader (header, value) {
  this._headers[header.toLowerCase()] = value
}

/**
 * Handle event ending from the current ServerResponse.
 *
 * @param {Buffer|ArrayBuffer|string[]} [chunk] - A chunk of data to write.
 * @param {string} [encoding] - The encoding for the chunk.
 * @param {Function} [onFinish] - A function that will be called when the response has finished.
 */
ServerResponse.prototype.end = function end (chunk, encoding, onFinish) {
  if (this.finished) return

  if (typeof chunk === 'function') {
    onFinish = chunk
    chunk = null
  } else if (typeof encoding === 'function') {
    onFinish = encoding
    encoding = null
  }

  if (chunk != null) {
    this._body.push(chunk)
  }

  if (typeof onFinish === 'function') {
    this.once('finish', onFinish)
  }

  if (this.statusCode == null) {
    this.statusCode = 200
  }

  if (this.statusMessage == null) {
    this.statusMessage = STATUS_CODES[this.statusCode]
  }

  if (this.sendDate) {
    this._headers['date'] = (new Date()).toUTCString()
  }

  this._headers['status'] = this.statusCode
  this.headersSent = true
  this.finished = true
  this.emit('finish')
}

/**
 * Creates a new server response and sets up some properties.
 *
 * @param {IncomingMessage} incomingMessage - The request that is assosiated with the response.
 * @return {ServerResponse}
 */
function createServerResponse (incomingMessage) {
  var serverResponse = new ServerResponse(incomingMessage)
  serverResponse._body = []
  return serverResponse
}
