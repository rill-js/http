'use strict'

require('ts-node/register')
require('source-map-support/register')
require('jsdom-global')('<!doctype html><html><head><meta charset="utf-8"></head><body></body></html>', { url: 'http://localhost:3000' })

// Polyfill fetch api and html5 history api.
require('es6-promise/auto')
require('isomorphic-fetch')
if (window === global) require('html5-history-api')

// Ignore scrolling
window.scrollTo = function () {}

// Patch jsdom with the fetch api.
if (!window.Headers) window.Headers = global.Headers
if (!window.Request) window.Request = global.Request
if (!window.Response) window.Response = global.Response

// Load rejections.
process.on('unhandledRejection', function (err) { throw err })
