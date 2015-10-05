# HTTP

Bring a nodejs style server into the client.

# Why
People love node, people love the programming style and it's flexability. This api exposes the "http" module as an isomorphic server. It essentually allows you to run your nodejs server in the browser for epic progressive enhancement and an isomorphic paradise. This is a low level library used by Rill (to be released) which implements an express style api on top of this.

# Installation

#### Npm
```console
npm install @rill/http
```

# Example

```javascript
var http = require("http");

window; //-> [Object object]

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

* Use gulp to run tests.

Please feel free to create a PR!
