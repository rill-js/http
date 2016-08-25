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
  <!-- Downloads -->
  <a href="https://npmjs.org/package/@rill/http">
    <img src="https://img.shields.io/npm/dm/@rill/http.svg?style=flat-square" alt="Downloads"/>
  </a>
  <!-- Gitter Chat -->
  <a href="https://gitter.im/rill-js/rill">
    <img src="https://img.shields.io/gitter/room/rill-js/rill.svg?style=flat-square" alt="Gitter Chat"/>
  </a>
</h1>

Bring a nodejs style server into the client by listening to link clicks and form submissions.

# Why
People love node, people love the programming style and it's flexibility. This api exposes the "http" module as an isomorphic server. It essentially allows you to run your nodejs server in the browser for epic progressive enhancement and an isomorphic paradise. This is a low level library used by [Rill](https://github.com/rill-js/rill) which implements an express style api on top of this.

# Installation

```console
npm install @rill/http
```

# Example

```javascript
// Note that the following code runs in the browser.

var http = require("@rill/http")

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

### Contributions

* Use `npm test` to run tests.

Please feel free to create a PR!
