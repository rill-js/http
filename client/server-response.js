'use strict'

var Buffer = require('buffer').Buffer
var EventEmitter = require('events').EventEmitter
var STATUS_CODES = require('statuses/codes.json')
function noop () {}

/**
 * Emulates nodes ServerResponse in the browser.
 * See: https://nodejs.org/api/http.html#http_class_http_serverresponse
 */
function ServerResponse (opts, server) {
  this._body = []
  this._headers = {}
  this.socket = this.connection = { server: server }
}
var proto = ServerResponse.prototype = Object.create(EventEmitter.prototype)

// Defaults.
proto.statusCode = null
proto.statusMessage = null
proto.sendDate = true
proto.finished = false

/**
 * Make some methods noops.
 */
proto.writeContinue =
proto.setTimeout =
proto.addTrailers = noop

/**
 * Writes to the response body.
 */
proto.write = function (chunk, encoding, cb) {
  this._body.push(Buffer.from(chunk))

  if (typeof encoding === 'function') {
    cb = encoding
    encoding = null
  }

  if (typeof cb === 'function') {
    this.once('finish', cb)
  }
}

/**
 * Write status, status message and headers the same as node js.
 */
proto.writeHead = function writeHead (statusCode, statusMessage, headers) {
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
 * Get a header the same as node js.
 */
proto.getHeader = function getHeader (header) {
  return this._headers[header.toLowerCase()]
}

/**
 * Remove a header the same as node js.
 */
proto.removeHeader = function removeHeader (header) {
  delete this._headers[header.toLowerCase()]
}

/**
 * Write a header the same as node js.
 */
proto.setHeader = function setHeader (header, value) {
  this._headers[header.toLowerCase()] = value
}

/**
 * Handle event ending the same as node js.
 */
proto.end = function end (chunk, encoding, cb) {
  if (this.finished) return

  if (typeof chunk === 'function') {
    cb = chunk
    chunk = null
  } else if (typeof encoding === 'function') {
    cb = encoding
    encoding = null
  }

  if (chunk != null) {
    this._body.push(Buffer.from(chunk))
  }

  if (typeof cb === 'function') {
    this.once('finish', cb)
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
  this.headers = this._headers
  this.body = Buffer.concat(this._body)
  this.emit('finish')
}

module.exports = ServerResponse
