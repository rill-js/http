'use strict'

var EventEmitter = require('events').EventEmitter
var global = require('global')
var empty = {}

/* istanbul ignore next */
var document = global.document || empty
/* istanbul ignore next */
var navigator = global.navigator || empty
/* istanbul ignore next */
var location = (global.history && global.history.location) || global.location || empty

/**
 * Emulates nodes IncomingMessage in the browser.
 * See: https://nodejs.org/api/http.html#http_class_http_incomingmessage
 */
function IncomingMessage (opts, server) {
  this.url = opts.url
  this.method = opts.method || 'GET'
  this.headers = opts.headers || {}
  this.headers['referer'] = opts.referrer
  this.headers['date'] = (new Date()).toUTCString()
  this.headers['host'] = location.host
  this.headers['cookie'] = document.cookie
  this.headers['user-agent'] = navigator.userAgent
  this.headers['accept-language'] = navigator.language
  this.headers['connection'] = 'keep-alive'
  this.headers['cache-control'] = 'max-age=0'
  this.headers['accept'] = '*/*'
  this.socket = this.connection = {
    server: server,
    remoteAddress: '127.0.0.1',
    encrypted: location.protocol === 'https:'
  }
  this.body = opts.body
  this.files = opts.files
  this._parsed = opts._parsed
  this._scroll = opts.scroll
  this._history = opts.history
}
var proto = IncomingMessage.prototype = Object.create(EventEmitter.prototype)

// Defaults
proto.httpVersionMajor = 1
proto.httpVersionMinor = 1
proto.httpVersion = proto.httpVersionMajor + '.' + proto.httpVersionMinor
proto.complete = false

module.exports = IncomingMessage
