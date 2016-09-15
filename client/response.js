'use strict'

var EventEmitter = require('events').EventEmitter
var STATUS_CODES = require('statuses/codes.json')
var noop = function () {}

function ServerResponse (opts) {
  this._headers = {}
  this._browserResponse = opts ? opts.browserResponse : opts;
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
proto.write =
proto.writeContinue =
proto.setTimeout =
proto.addTrailers = noop

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
proto.end = function end () {
  if (this.finished) return

  if (this.statusMessage == null) {
    this.statusMessage = STATUS_CODES[this.statusCode]
  }

  if (this.sendDate) {
    this._headers['date'] = (new Date()).toUTCString()
  }

  this._headers['status'] = this.statusCode
  this.headersSent = true
  this.finished = true
  if(!this._browserResponse){
    return this.emit('finish', this);
  }
  let body = this.body;
  switch(typeof this.body){
    case 'string': body = [body]; break;
    case 'function': body = this.body(this); break;
    default: break;
  }
  this.emit('finish', new Response(new Blob(body), {headers:this.headers}));
}

module.exports = ServerResponse
