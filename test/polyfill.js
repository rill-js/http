'use strict'

// Polyfill history and fetch api's
require('html5-history-api')
require('es6-promise/auto')
require('isomorphic-fetch')

// Patch jsdom with the fetch api.
if (!window.Headers) window.Headers = global.Headers
if (!window.Request) window.Request = global.Request
if (!window.Response) window.Response = global.Response

// Load rejections.
process.on('unhandledRejection', function (err) { throw err })
