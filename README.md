<h1 align="center">
  <!-- Logo -->
  <img src="https://raw.githubusercontent.com/rill-js/rill/master/Rill-Icon.jpg" alt="Rill"/>
  <br/>
  @rill/http
	<br/>

  <!-- Stability -->
  <a href="https://nodejs.org/api/documentation.html#documentation_stability_index">
    <img src="https://img.shields.io/badge/stability-stable-brightgreen.svg?style=flat-square" alt="API stability"/>
  </a>
  <!-- TypeScript -->
  <a href="http://typescriptlang.org">
    <img src="https://img.shields.io/badge/%3C%2F%3E-typescript-blue.svg" alt="TypeScript"/>
  </a>
  <!-- NPM version -->
  <a href="https://npmjs.org/package/@rill/http">
    <img src="https://img.shields.io/npm/v/@rill/http.svg?style=flat-square" alt="NPM version"/>
  </a>
  <!-- Travis build -->
  <a href="https://travis-ci.org/rill-js/http">
  <img src="https://img.shields.io/travis/rill-js/http.svg?style=flat-square" alt="Build status"/>
  </a>
  <!-- Coveralls coverage -->
  <a href="https://coveralls.io/github/rill-js/http">
    <img src="https://img.shields.io/coveralls/rill-js/http.svg?style=flat-square" alt="Test Coverage"/>
  </a>
  <!-- Downloads -->
  <a href="https://npmjs.org/package/@rill/http">
    <img src="https://img.shields.io/npm/dm/@rill/http.svg?style=flat-square" alt="Downloads"/>
  </a>
  <!-- Gitter chat -->
  <a href="https://gitter.im/rill-js/rill">
    <img src="https://img.shields.io/gitter/room/rill-js/rill.svg?style=flat-square" alt="Gitter Chat"/>
  </a>
  <!-- Saucelabs -->
  <a href="https://saucelabs.com/u/rill-js">
    <img src="https://saucelabs.com/browser-matrix/rill-js.svg" alt="Sauce Test Status"/>
  </a>
</h1>

Bring a nodejs style server into the browser. This allows for universal routing (shared between client and server).

This module supports many environments including Service Workers, Web Workers, and a standard webpage. A [document adapter](#document-adapter) also exists which allows for link and form interception for handling requests automatically within the browser.

# Why
This api exposes the "http" module as an isomorphic server. It essentially allows you to run your nodejs server in the browser for epic progressive enhancement and an isomorphic paradise. This is a low level library used by [Rill](https://github.com/rill-js/rill) which implements an express style api on top of this.

# Browser support
All modern browsers are supported including IE10 and above.

Older browsers and IE will also need to polyfill the Promise API, checkout [es6-promise](https://github.com/stefanpenner/es6-promise) for a good polyfill, babel-polyfill also covers this.

## Installation

```console
npm install @rill/http
```

## Example

```javascript
// Note that the following code runs in pretty much any environment (with optional babel transpilation).

import http from '@rill/http'

const server = http.createServer((req, res)=> {
  console.log(req.method, req.url)
  res.end()
})

/**
 * Listening in the browser will intelligently intercept link clicks and form
 * submissions and feed them into the registered handler.
 */
server.listen()
```

## Document Adapter
This adapter provides adds the following features to an existing @rill/http server:

* Intercepts links and forms and forwards them through the http server.
* Supports the html5 history api, enabling the back button to also be handled by the server.
* Adds useful meta data to each request (cookies, headers, etc).
* Handles response headers such as 'set-cookie', 'refresh' and 'location'.

In the future there may be more adapters for different environments such as mobile.

```javascript
import { attach, fetch } from '@rill/http/adapter/document'

// Apply document adapter to an existing server.
attach(server)

// Adapters also provide a 'fetch' api similar to the native fetch api to request things from a server.
fetch(server, { url: '/test', method: 'POST', body: { a: 1 } })
  .then(([body, res]) => {
    // body will be a blob of data created from the response.
    // res contains response meta data (status, statusText, headers and url).
    // You can easily convert this to a native fetch response as well.
    const blob = new Blob(body, { type: res.headers['content-type'] })
    return new Response(blob, res)
  })
  .then(res => res.json())
  .then(console.log)

// The document adapter fetch api also supports the ability to parse an html form.
// The form will be parsed into the requets body (or query string on GET requests).
const myForm = document.getElementById('myForm')
fetch(server, { url: '/test', method: 'POST', form: myForm })
```

### Contributions

* Use `npm test` to run tests.

Please feel free to create a PR!
