[![js-standard-style](https://img.shields.io/badge/code%20style-standard-brightgreen.svg)](http://standardjs.com/)
[![Chat about Rill at https://gitter.im/rill-js/rill](https://badges.gitter.im/rill-js/rill.svg)](https://gitter.im/rill-js/rill?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)

# HTTP

Bring a nodejs style server into the client.

# Why
People love node, people love the programming style and it's flexability. This api exposes the "http" module as an isomorphic server. It essentually allows you to run your nodejs server in the browser for epic progressive enhancement and an isomorphic paradise. This is a low level library used by [Rill](https://github.com/rill-js/rill) which implements an express style api on top of this.

# Installation

#### Npm
```console
npm install @rill/http
```

# Example

```javascript
// Note that the following code runs in the browser.

var http = require("@rill/http");

var server = http.createServer(function handler (req, res) {
	console.log(req.method, req.url);
	res.end();
});

/**
 * Listening in the browser will intelegently intercept link clicks and form
 * submissions and feed them into the registered handler.
 */
server.listen();
```

### Contributions

* Use `npm test` to run tests.

Please feel free to create a PR!
