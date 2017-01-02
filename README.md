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
  <!-- Standard -->
  <a href="https://github.com/feross/standard">
    <img src="https://img.shields.io/badge/code%20style-standard-brightgreen.svg?style=flat-square" alt="Standard"/>
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

Bring a nodejs style server into the client by listening to link clicks and form submissions.
Supports modern browsers. A [whatwg-fetch polyfill](https://github.com/github/fetch) is also required for IE and safari. You can support IE9 with a [History API polyfill](https://github.com/devote/HTML5-History-API) as well.

# Why
People love node, people love the programming style and it's flexibility. This api exposes the "http" module as an isomorphic server. It essentially allows you to run your nodejs server in the browser for epic progressive enhancement and an isomorphic paradise. This is a low level library used by [Rill](https://github.com/rill-js/rill) which implements an express style api on top of this.

# Installation

```console
npm install @rill/http
```

# Example

```javascript
// Note that the following code runs in pretty much any environment.

var http = require('@rill/http')

var server = http.createServer((req, res)=> {
	console.log(req.method, req.url)
	res.end()
});

/**
 * Listening in the browser will intelligently intercept link clicks and form
 * submissions and feed them into the registered handler.
 */
server.listen()
```

# Browser Adapter
By default @rill/http no longer will intercept link clicks and form submissions (although Rill still will). Instead you can adapt an existing @rill/http server to hijack the browser as well as add browser specific features such as cookies.

In the future there may be more adapters for different environments such as mobile.

```javascript
var browserAdapter = require('@rill/http/adapter/browser')
var server = browserAdapter(http.createServer())

// Adapters also provide a 'fetch' api similar to the native fetch api to request things from a server.
var fetch = browserAdapter.fetch

// The only difference in the api is that the 'server' must be the first argument.
fetch(server, '/test', { method: 'POST' })
  .then(res => res.json())
  .then(console.log.bind(console))
```

### Contributions

* Use `npm test` to run tests.

Please feel free to create a PR!
