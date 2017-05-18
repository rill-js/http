'use strict'

// Polyfill fetch api and html5 history api.
require('es6-promise/auto')
require('isomorphic-fetch')
if (window === global) require('html5-history-api')

// Patch jsdom with the fetch api.
if (!window.Headers) window.Headers = global.Headers
if (!window.Request) window.Request = global.Request
if (!window.Response) window.Response = global.Response

// Load rejections.
process.on('unhandledRejection', function (err) { throw err })
