'use strict'

require('ts-node/register')
require('source-map-support/register')
require('jsdom-global')('<!doctype html><html><head><meta charset="utf-8"></head><body></body></html>', { url: 'http://localhost:3000' })
