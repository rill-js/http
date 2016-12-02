'use strict'

var http = require('http')

// Log useful warning when using 'fetch' in the server side.
http.Server.prototype.fetch = function fetch () {
  throw new Error('@rill/http: Server#fetch can only be used in the browser.')
}

// Expose native http module.
module.exports = require('http')
