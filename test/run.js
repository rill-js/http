(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
var Server = require("./server");

module.exports = {
	Server: Server,
	createServer: function createServer (handler) {
		return new Server(handler);
	}
};
},{"./server":4}],2:[function(require,module,exports){
var EventEmitter = require("events").EventEmitter;
var referrer     = document.referrer;

function IncomingMessage (opts) {
	this.url                        = opts.url;
	this.method                     = opts.method || "GET";
	this.headers                    = opts.headers || {};
	this.headers["host"]            = location.host;
	this.headers["cookie"]          = document.cookie;
	this.headers["user-agent"]      = navigator.userAgent;
	this.headers["accept-language"] = navigator.language;
	this.headers["referer"]         = referrer;
	this.connection                 = {
		remoteAddress: "127.0.0.1",
		encrypted: location.protocol === "https:"
	};
	this.body = opts.body;
	this.files = opts.files;
	referrer = opts.url;
}
var proto = IncomingMessage.prototype = Object.create(EventEmitter.prototype);

// Defaults
proto.complete = false;

module.exports = IncomingMessage;
},{"events":15}],3:[function(require,module,exports){
var EventEmitter = require("events").EventEmitter;
var noop         = function () {};

function ServerResponse (opts) {
	this.headers = {};
}
var proto = ServerResponse.prototype = Object.create(EventEmitter.prototype);

// Defaults.
proto.statusCode    = null;
proto.statusMessage = null;
proto.sendDate      = true;
proto.finished      = false;

/**
 * Make some methods noops.
 */
proto.write         = 
proto.writeHead     = 
proto.writeContinue = 
proto.setTimeout    = 
proto.setHeader     = 
proto.getHeader     = 
proto.removeHeader  = 
proto.addTrailers   = noop;

/**
 * Handle event ending the same as node js.
 */
proto.end = function end () {
	this.finished = true;
	this.emit("finish");
};

module.exports = ServerResponse;
},{"events":15}],4:[function(require,module,exports){
var EventEmitter = require("events");
var serialize    = require("@rill/form-json");
var parseURL     = require("@rill/parse-url");
var Request      = require("./request.js");
var Response     = require("./response.js");
var reg          = {
	hash: /#.+$/,
	rel:  /(?:^|\s+)external(?:\s+|$)/
};

/**
 * Emulates node js http server in the browser.
 *
 * @param {Function} handle - the handle for a request.
 */
function Server (handler) {
	this._started = false;
	this._handler = handler;
	this._handle  = this;
}
var proto = Server.prototype = Object.create(EventEmitter.prototype);

/**
 * Listen to all url change events on a dom element and trigger the server callback.
 */
proto.listen = function listen () {
	var cb            = arguments[arguments.length - 1];
	this._onURLChange = onURLChange.bind(this);
	this._onSubmit    = onSubmit.bind(this);
	this._onClick     = onClick.bind(this);

	window.addEventListener("DOMContentLoaded", this._onURLChange);
	window.addEventListener("popstate", this._onURLChange);
	window.addEventListener("submit", this._onSubmit);
	window.addEventListener("click", this._onClick);

	if (typeof callback === "function") setTimeout(cb, 0);
	return this;
};

/**
 * Closes the server and destroys all event listeners.
 */
proto.close = function close () {
	var cb = arguments[arguments.length - 1];

	window.removeEventListener("DOMContentLoaded", this._onURLChange);
	window.removeEventListener("popstate", this._onURLChange);
	window.removeEventListener("submit", this._onSubmit);
	window.removeEventListener("click", this._onClick);

	if (typeof callback === "function") setTimeout(db, 0);
	this.emit("close");
	return this;
};

/*
 * Trigger the registered handle to navigate to a given url.
 *
 * @param {String|Object} req
 * @param {Boolean} replaceState
 * @api private
 */
proto.navigate = function navigate (opts, replaceState) {
	if (typeof opts === "string") opts = { url: opts };

	var self = this;
	var req  = new Request(opts);
	var res  = new Response();

	res.once("finish", function onEnd() {
		req.complete = true;
		req.emit("finsish");
		// Check to see if we should update the url.
		if (req.method !== "GET" || res.headers["location"]) return;

		var hash = req.url.match(reg.hash);
		hash     = hash ? hash[0] : null;

		/*
		 * When navigating a user will be brought to the top of the page.
		 * If the urls contains a hash that is the id of an element (a target) then the target will be scrolled to.
		 * This is similar to how browsers handle page transitions natively.
		 */
		if (hash != null) {
			target = document.getElementById(hash.slice(1));
			if (target) target.scrollIntoView({ block: "start", behavior: "smooth" });
		} else if (self._started) {
			window.scrollTo(0, 0);
		}

		self._started = true;

		history[replaceState
			? "replaceState"
			: "pushState"
		](null, "", req.url);
	});

	this.emit("request", req, res);
	this._handler(req, res);
	return this;
};

/*
 * Handle an event that changed the url (popstate or page load).
 *
 * @param {Object} event
 */
function onURLChange (e) {
	this.navigate(location.href, true);
};

/*
 * Handle intercepting forms to update the url.
 *
 * @param {Object} event
 */
function onSubmit (e) {
	// Ignore canceled events.
	if (e.defaultPrevented) return;

	// Get the <form> element.
	var el = event.target;

	// Ignore clicks from linkless elements
	if (!el.action) return;

	var url = el.action;
	// Ignore the click if the element has a target.
	if (el.target && el.target !== "_self") return;
	// Ignore 'rel="external"' links.
	if (el.hasAttribute("rel") && reg.rel.test(el.getAttribute("rel"))) return;

	// Use a url parser to parse URLs instead of relying on the browser
	// to do it for us (because IE).
	var parsed = parseURL(url);
	// Ignore links that don't share a protocol with the browsers.
	if (location.protocol.indexOf(parsed.protocol) === -1) return;
	// Ignore links that don't share a host with the browsers.
	if (location.host !== parsed.host) return;

	var serialized = serialize(el);
	var method = (el.getAttribute("method") || el.method).toUpperCase();
	
	if (method === "GET") {
		// Ignore qs when using GET (consistent with browsers).
		this.navigate(url.split("?")[0] + "?" + JSON.stringify(serialized.body));
	} else {
		this.navigate({
			url: url,
			method: method,
			body: serialized.body,
			files: serialized.files
		})
	}

	if (!el.hasAttribute("data-noreset")) el.reset();
	event.preventDefault();
};

/*
 * Handle intercepting link clicks to update the url.
 *
 * @param {Object} event
 */
function onClick (e) {
	// Ignore canceled events, modified clicks, and right clicks.
	if (event.defaultPrevented ||
		event.metaKey ||
		event.ctrlKey ||
		event.shiftKey ||
		event.button !== 0) return;

	// Get the <form> element.
	var el = event.target;
	while (el != null && el.nodeName !== "A") el = el.parentNode;

	// Ignore if we couldn't find a link.
	if (!el) return;

	// Ignore clicks from linkless elements
	if (!el.href) return;

	var url = el.href;
	// Ignore downloadable links.
	if (el.download) return;
	// Ignore the click if the element has a target.
	if (el.target && el.target !== "_self") return;
	// Ignore 'rel="external"' links.
	if (el.rel && reg.rel.test(el.rel)) return;

	// Use a url parser to parse URLs instead of relying on the browser
	// to do it for us (because IE).
	var parsed = parseURL(url);
	// Ignore links that don't share a protocol with the browsers.
	if (location.protocol.indexOf(parsed.protocol) === -1) return;
	// Ignore links that don't share a host with the browsers.
	if (location.host !== parsed.host) return;

	this.navigate(url);
	event.preventDefault();
};

module.exports = Server;
},{"./request.js":2,"./response.js":3,"@rill/form-json":5,"@rill/parse-url":6,"events":15}],5:[function(require,module,exports){
/** Rill(form-json) v0.1.0 */
var matchArray, setter, urlencoded;

urlencoded = "application/x-www-form-urlencoded";

matchArray = /[^\[\]]+|(?=\[\])/gi;


/*
 * Utility to create a setter for a parsed form body.
 * The setter will create arrays for values like "a[]" if the enctype is urlencoded.
#
 * @param {Object} obj
 * @param {Boolean} encoded
 * @param {*} function
 */

setter = function(obj, enctype) {
  return function(path, val) {
    var cur, key, keys, prev;
    if (enctype !== urlencoded) {
      return obj[path] = val;
    }
    keys = path.match(matchArray);
    cur = obj;
    while (keys.length) {
      prev = cur;
      key = keys.shift();
      if (key === "") {
        key = cur.length;
      }
      cur = cur[key] != null ? cur[key] : cur[key] = (keys[0] === "" ? [] : {});
    }
    prev[key] = val;
  };
};


/*
 * Serialize a html form as JSON.
#
 * @param {<Form/>} form
 * @returns { body, files }
 */

module.exports = function(form) {
  var body, disabled, element, file, files, i, j, len, len1, name, nodeName, ref, ref1, ref2, selected, set, value;
  if ((form != null ? form.nodeName : void 0) !== "FORM") {
    throw new Error("Can only parse form elements.");
  }
  body = {};
  files = [];
  set = setter(body, form.enctype || urlencoded);
  ref = form.elements;
  for (i = 0, len = ref.length; i < len; i++) {
    element = ref[i];
    name = element.name, disabled = element.disabled, nodeName = element.nodeName;
    if (!name || disabled || (nodeName !== "INPUT" && nodeName !== "TEXTAREA" && nodeName !== "SELECT" && nodeName !== "BUTTON")) {
      continue;
    }
    switch (element.type) {
      case "submit":
        if (element === document.activeElement) {
          set(name, element.value);
        }
        break;
      case "checkbox":
      case "radio":
        if (element.checked) {
          set(name, element.value);
        }
        break;
      case "select-one":
        set(name, (ref1 = element.options[element.selectedIndex]) != null ? ref1.value : void 0);
        break;
      case "select-multiple":
        set(name, (function() {
          var j, len1, ref2, ref3, results;
          ref2 = element.options;
          results = [];
          for (j = 0, len1 = ref2.length; j < len1; j++) {
            ref3 = ref2[j], value = ref3.value, selected = ref3.selected;
            if (selected) {
              results.push(value);
            }
          }
          return results;
        })());
        break;
      case "file":
        if (element.files) {
          ref2 = element.files;
          for (j = 0, len1 = ref2.length; j < len1; j++) {
            file = ref2[j];
            file.field = name;
            files.push(file);
          }
        }
        break;
      default:
        set(name, element.value);
    }
  }
  return {
    body: body,
    files: files
  };
};

},{}],6:[function(require,module,exports){
/** Rill(parse-url) v0.3.1 */
"use strict";
var dateReg, httpReg, parseDates, urllite;

urllite = require("urllite");

httpReg = /^https?:\/\//i;

dateReg = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2}(?:\.\d*))(?:Z|(\+|-)([\d|:]*))?$/;


/*
 * When used as a transform for JSON.parse date strings will be turned into date objects.
#
 * @param {String} key
 * @param {String} val
 */

parseDates = function(key, val) {
  if ("string" === typeof val && dateReg.test(val)) {
    return new Date(val);
  } else {
    return val;
  }
};


/*
 * Extract a parsed url from a request object.
#
 * @param {Request} req
 */

module.exports = function(url, req) {
  var defaults, err, hostname, parsed, port, protocol, ref, ref1;
  if (url == null) {
    url = "/";
  }
  defaults = (req instanceof Node ? req : location);
  protocol = (defaults.protocol ? (":" === defaults.protocol.slice(-1) ? defaults.protocol.slice(0, -1) : defaults.protocol) : "http");
  port = (defaults.port ? ":" + defaults.port : "");
  url = (httpReg.test(url) ? url : protocol + "://" + defaults.hostname + port + url);
  parsed = urllite(url);
  parsed.search = decodeURIComponent(parsed.search);
  parsed.search = parsed.search.slice(1, +parsed.search.lastIndexOf("}") + 1 || 9e9);
  try {
    parsed.query = JSON.parse(parsed.search, parseDates);
  } catch (_error) {
    err = _error;
    parsed.query = {};
  }
  return {
    url: url,
    origin: parsed.origin,
    protocol: parsed.protocol.slice(0, -1),
    host: parsed.host,
    hostname: parsed.hostname,
    port: parsed.port,
    path: parsed.pathname,
    search: parsed.search,
    query: parsed.query,
    hash: parsed.hash.slice(1)
  };
};

},{"urllite":7}],7:[function(require,module,exports){
(function() {
  var urllite;

  urllite = require('./core');

  require('./extensions/resolve');

  require('./extensions/relativize');

  require('./extensions/normalize');

  require('./extensions/toString');

  module.exports = urllite;

}).call(this);

},{"./core":8,"./extensions/normalize":9,"./extensions/relativize":10,"./extensions/resolve":11,"./extensions/toString":12}],8:[function(require,module,exports){
(function() {
  var URL, URL_PATTERN, defaults, urllite,
    __hasProp = {}.hasOwnProperty;

  URL_PATTERN = /^(?:(?:([^:\/?\#]+:)\/+|(\/\/))(?:([a-z0-9-\._~%]+)(?::([a-z0-9-\._~%]+))?@)?(([a-z0-9-\._~%!$&'()*+,;=]+)(?::([0-9]+))?)?)?([^?\#]*?)(\?[^\#]*)?(\#.*)?$/;

  urllite = function(raw, opts) {
    return urllite.URL.parse(raw, opts);
  };

  urllite.URL = URL = (function() {
    function URL(props) {
      var k, v, _ref;
      for (k in defaults) {
        if (!__hasProp.call(defaults, k)) continue;
        v = defaults[k];
        this[k] = (_ref = props[k]) != null ? _ref : v;
      }
      this.host || (this.host = this.hostname && this.port ? "" + this.hostname + ":" + this.port : this.hostname ? this.hostname : '');
      this.origin || (this.origin = this.protocol ? "" + this.protocol + "//" + this.host : '');
      this.isAbsolutePathRelative = !this.host && this.pathname.charAt(0) === '/';
      this.isPathRelative = !this.host && this.pathname.charAt(0) !== '/';
      this.isRelative = this.isSchemeRelative || this.isAbsolutePathRelative || this.isPathRelative;
      this.isAbsolute = !this.isRelative;
    }

    URL.parse = function(raw) {
      var m, pathname, protocol;
      m = raw.toString().match(URL_PATTERN);
      pathname = m[8] || '';
      protocol = m[1];
      return new urllite.URL({
        protocol: protocol,
        username: m[3],
        password: m[4],
        hostname: m[6],
        port: m[7],
        pathname: protocol && pathname.charAt(0) !== '/' ? "/" + pathname : pathname,
        search: m[9],
        hash: m[10],
        isSchemeRelative: m[2] != null
      });
    };

    return URL;

  })();

  defaults = {
    protocol: '',
    username: '',
    password: '',
    host: '',
    hostname: '',
    port: '',
    pathname: '',
    search: '',
    hash: '',
    origin: '',
    isSchemeRelative: false
  };

  module.exports = urllite;

}).call(this);

},{}],9:[function(require,module,exports){
(function() {
  var URL, extend, urllite;

  urllite = require('../core');

  URL = urllite.URL;

  extend = require('xtend');

  URL.prototype.normalize = function() {
    var m, pathname;
    pathname = this.pathname;
    while (m = /^(.*?)[^\/]+\/\.\.\/*(.*)$/.exec(pathname)) {
      pathname = "" + m[1] + m[2];
    }
    if (this.host && pathname.indexOf('..') !== -1) {
      throw new Error('Path is behind root.');
    }
    return new urllite.URL(extend(this, {
      pathname: pathname
    }));
  };

}).call(this);

},{"../core":8,"xtend":13}],10:[function(require,module,exports){
(function() {
  var URL, urllite;

  urllite = require('../core');

  require('./resolve');

  URL = urllite.URL;

  URL.prototype.relativize = function(other) {
    var c, i, newSegments, otherSegments, url, urlSegments, _i, _len, _ref;
    if (this.isPathRelative) {
      return new urllite.URL(this);
    }
    if (typeof other === 'string') {
      other = urllite(other);
    }
    url = this.resolve(other);
    if (url.origin && url.origin !== other.origin) {
      throw new Error("Origins don't match (" + url.origin + " and " + other.origin + ")");
    } else if (!other.isAbsolute && !other.isAbsolutePathRelative) {
      throw new Error("Other URL (<" + other + ">) is neither absolute nor absolute path relative.");
    }
    otherSegments = other.pathname.split('/').slice(1);
    urlSegments = url.pathname.split('/').slice(1);
    for (i = _i = 0, _len = urlSegments.length; _i < _len; i = ++_i) {
      c = urlSegments[i];
      if (!(c === otherSegments[i] && (urlSegments.length > (_ref = i + 1) && _ref < otherSegments.length))) {
        break;
      }
    }
    newSegments = urlSegments.slice(i);
    while (i < otherSegments.length - 1) {
      if (otherSegments[i]) {
        newSegments.unshift('..');
      }
      i++;
    }
    if (newSegments.length === 1) {
      newSegments = newSegments[0] === otherSegments[i] ? [''] : newSegments[0] === '' ? ['.'] : newSegments;
    }
    return new urllite.URL({
      pathname: newSegments.join('/'),
      search: url.search,
      hash: url.hash
    });
  };

}).call(this);

},{"../core":8,"./resolve":11}],11:[function(require,module,exports){
(function() {
  var URL, copyProps, oldParse, urllite,
    __slice = [].slice;

  urllite = require('../core');

  require('./normalize');

  URL = urllite.URL;

  oldParse = URL.parse;

  copyProps = function() {
    var prop, props, source, target, _i, _len;
    target = arguments[0], source = arguments[1], props = 3 <= arguments.length ? __slice.call(arguments, 2) : [];
    for (_i = 0, _len = props.length; _i < _len; _i++) {
      prop = props[_i];
      target[prop] = source[prop];
    }
    return target;
  };

  URL.parse = function(raw, opts) {
    var base, url;
    if (base = opts != null ? opts.base : void 0) {
      delete opts.base;
    }
    url = oldParse(raw, opts);
    if (base) {
      return url.resolve(base);
    } else {
      return url;
    }
  };

  URL.prototype.resolve = function(base) {
    var p, prefix;
    if (this.isAbsolute) {
      return new urllite.URL(this);
    }
    if (typeof base === 'string') {
      base = urllite(base);
    }
    p = {};
    if (this.isSchemeRelative) {
      copyProps(p, this, 'username', 'password', 'host', 'hostname', 'port', 'pathname', 'search', 'hash');
      p.isSchemeRelative = !(p.protocol = base.protocol);
    } else if (this.isAbsolutePathRelative || this.isPathRelative) {
      copyProps(p, this, 'search', 'hash');
      copyProps(p, base, 'protocol', 'username', 'password', 'host', 'hostname', 'port');
      p.pathname = this.isPathRelative ? base.pathname.slice(0, -1) === '/' ? "" + base.pathname + "/" + this.pathname : (prefix = base.pathname.split('/').slice(0, -1).join('/'), prefix ? "" + prefix + "/" + this.pathname : this.pathname) : this.pathname;
    }
    return new urllite.URL(p).normalize();
  };

}).call(this);

},{"../core":8,"./normalize":9}],12:[function(require,module,exports){
(function() {
  var URL, urllite;

  urllite = require('../core');

  URL = urllite.URL;

  URL.prototype.toString = function() {
    var authority, prefix, userinfo;
    prefix = this.isSchemeRelative ? '//' : this.protocol === 'file:' ? "" + this.protocol + "///" : this.protocol ? "" + this.protocol + "//" : '';
    userinfo = this.password ? "" + this.username + ":" + this.password : this.username ? "" + this.username : '';
    authority = userinfo ? "" + userinfo + "@" + this.host : this.host ? "" + this.host : '';
    return "" + prefix + authority + this.pathname + this.search + this.hash;
  };

}).call(this);

},{"../core":8}],13:[function(require,module,exports){
module.exports = extend

function extend() {
    var target = {}

    for (var i = 0; i < arguments.length; i++) {
        var source = arguments[i]

        for (var key in source) {
            if (source.hasOwnProperty(key)) {
                target[key] = source[key]
            }
        }
    }

    return target
}

},{}],14:[function(require,module,exports){
// http://wiki.commonjs.org/wiki/Unit_Testing/1.0
//
// THIS IS NOT TESTED NOR LIKELY TO WORK OUTSIDE V8!
//
// Originally from narwhal.js (http://narwhaljs.org)
// Copyright (c) 2009 Thomas Robinson <280north.com>
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the 'Software'), to
// deal in the Software without restriction, including without limitation the
// rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
// sell copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN
// ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
// WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

// when used in node, this will actually load the util module we depend on
// versus loading the builtin util module as happens otherwise
// this is a bug in node module loading as far as I am concerned
var util = require('util/');

var pSlice = Array.prototype.slice;
var hasOwn = Object.prototype.hasOwnProperty;

// 1. The assert module provides functions that throw
// AssertionError's when particular conditions are not met. The
// assert module must conform to the following interface.

var assert = module.exports = ok;

// 2. The AssertionError is defined in assert.
// new assert.AssertionError({ message: message,
//                             actual: actual,
//                             expected: expected })

assert.AssertionError = function AssertionError(options) {
  this.name = 'AssertionError';
  this.actual = options.actual;
  this.expected = options.expected;
  this.operator = options.operator;
  if (options.message) {
    this.message = options.message;
    this.generatedMessage = false;
  } else {
    this.message = getMessage(this);
    this.generatedMessage = true;
  }
  var stackStartFunction = options.stackStartFunction || fail;

  if (Error.captureStackTrace) {
    Error.captureStackTrace(this, stackStartFunction);
  }
  else {
    // non v8 browsers so we can have a stacktrace
    var err = new Error();
    if (err.stack) {
      var out = err.stack;

      // try to strip useless frames
      var fn_name = stackStartFunction.name;
      var idx = out.indexOf('\n' + fn_name);
      if (idx >= 0) {
        // once we have located the function frame
        // we need to strip out everything before it (and its line)
        var next_line = out.indexOf('\n', idx + 1);
        out = out.substring(next_line + 1);
      }

      this.stack = out;
    }
  }
};

// assert.AssertionError instanceof Error
util.inherits(assert.AssertionError, Error);

function replacer(key, value) {
  if (util.isUndefined(value)) {
    return '' + value;
  }
  if (util.isNumber(value) && !isFinite(value)) {
    return value.toString();
  }
  if (util.isFunction(value) || util.isRegExp(value)) {
    return value.toString();
  }
  return value;
}

function truncate(s, n) {
  if (util.isString(s)) {
    return s.length < n ? s : s.slice(0, n);
  } else {
    return s;
  }
}

function getMessage(self) {
  return truncate(JSON.stringify(self.actual, replacer), 128) + ' ' +
         self.operator + ' ' +
         truncate(JSON.stringify(self.expected, replacer), 128);
}

// At present only the three keys mentioned above are used and
// understood by the spec. Implementations or sub modules can pass
// other keys to the AssertionError's constructor - they will be
// ignored.

// 3. All of the following functions must throw an AssertionError
// when a corresponding condition is not met, with a message that
// may be undefined if not provided.  All assertion methods provide
// both the actual and expected values to the assertion error for
// display purposes.

function fail(actual, expected, message, operator, stackStartFunction) {
  throw new assert.AssertionError({
    message: message,
    actual: actual,
    expected: expected,
    operator: operator,
    stackStartFunction: stackStartFunction
  });
}

// EXTENSION! allows for well behaved errors defined elsewhere.
assert.fail = fail;

// 4. Pure assertion tests whether a value is truthy, as determined
// by !!guard.
// assert.ok(guard, message_opt);
// This statement is equivalent to assert.equal(true, !!guard,
// message_opt);. To test strictly for the value true, use
// assert.strictEqual(true, guard, message_opt);.

function ok(value, message) {
  if (!value) fail(value, true, message, '==', assert.ok);
}
assert.ok = ok;

// 5. The equality assertion tests shallow, coercive equality with
// ==.
// assert.equal(actual, expected, message_opt);

assert.equal = function equal(actual, expected, message) {
  if (actual != expected) fail(actual, expected, message, '==', assert.equal);
};

// 6. The non-equality assertion tests for whether two objects are not equal
// with != assert.notEqual(actual, expected, message_opt);

assert.notEqual = function notEqual(actual, expected, message) {
  if (actual == expected) {
    fail(actual, expected, message, '!=', assert.notEqual);
  }
};

// 7. The equivalence assertion tests a deep equality relation.
// assert.deepEqual(actual, expected, message_opt);

assert.deepEqual = function deepEqual(actual, expected, message) {
  if (!_deepEqual(actual, expected)) {
    fail(actual, expected, message, 'deepEqual', assert.deepEqual);
  }
};

function _deepEqual(actual, expected) {
  // 7.1. All identical values are equivalent, as determined by ===.
  if (actual === expected) {
    return true;

  } else if (util.isBuffer(actual) && util.isBuffer(expected)) {
    if (actual.length != expected.length) return false;

    for (var i = 0; i < actual.length; i++) {
      if (actual[i] !== expected[i]) return false;
    }

    return true;

  // 7.2. If the expected value is a Date object, the actual value is
  // equivalent if it is also a Date object that refers to the same time.
  } else if (util.isDate(actual) && util.isDate(expected)) {
    return actual.getTime() === expected.getTime();

  // 7.3 If the expected value is a RegExp object, the actual value is
  // equivalent if it is also a RegExp object with the same source and
  // properties (`global`, `multiline`, `lastIndex`, `ignoreCase`).
  } else if (util.isRegExp(actual) && util.isRegExp(expected)) {
    return actual.source === expected.source &&
           actual.global === expected.global &&
           actual.multiline === expected.multiline &&
           actual.lastIndex === expected.lastIndex &&
           actual.ignoreCase === expected.ignoreCase;

  // 7.4. Other pairs that do not both pass typeof value == 'object',
  // equivalence is determined by ==.
  } else if (!util.isObject(actual) && !util.isObject(expected)) {
    return actual == expected;

  // 7.5 For all other Object pairs, including Array objects, equivalence is
  // determined by having the same number of owned properties (as verified
  // with Object.prototype.hasOwnProperty.call), the same set of keys
  // (although not necessarily the same order), equivalent values for every
  // corresponding key, and an identical 'prototype' property. Note: this
  // accounts for both named and indexed properties on Arrays.
  } else {
    return objEquiv(actual, expected);
  }
}

function isArguments(object) {
  return Object.prototype.toString.call(object) == '[object Arguments]';
}

function objEquiv(a, b) {
  if (util.isNullOrUndefined(a) || util.isNullOrUndefined(b))
    return false;
  // an identical 'prototype' property.
  if (a.prototype !== b.prototype) return false;
  // if one is a primitive, the other must be same
  if (util.isPrimitive(a) || util.isPrimitive(b)) {
    return a === b;
  }
  var aIsArgs = isArguments(a),
      bIsArgs = isArguments(b);
  if ((aIsArgs && !bIsArgs) || (!aIsArgs && bIsArgs))
    return false;
  if (aIsArgs) {
    a = pSlice.call(a);
    b = pSlice.call(b);
    return _deepEqual(a, b);
  }
  var ka = objectKeys(a),
      kb = objectKeys(b),
      key, i;
  // having the same number of owned properties (keys incorporates
  // hasOwnProperty)
  if (ka.length != kb.length)
    return false;
  //the same set of keys (although not necessarily the same order),
  ka.sort();
  kb.sort();
  //~~~cheap key test
  for (i = ka.length - 1; i >= 0; i--) {
    if (ka[i] != kb[i])
      return false;
  }
  //equivalent values for every corresponding key, and
  //~~~possibly expensive deep test
  for (i = ka.length - 1; i >= 0; i--) {
    key = ka[i];
    if (!_deepEqual(a[key], b[key])) return false;
  }
  return true;
}

// 8. The non-equivalence assertion tests for any deep inequality.
// assert.notDeepEqual(actual, expected, message_opt);

assert.notDeepEqual = function notDeepEqual(actual, expected, message) {
  if (_deepEqual(actual, expected)) {
    fail(actual, expected, message, 'notDeepEqual', assert.notDeepEqual);
  }
};

// 9. The strict equality assertion tests strict equality, as determined by ===.
// assert.strictEqual(actual, expected, message_opt);

assert.strictEqual = function strictEqual(actual, expected, message) {
  if (actual !== expected) {
    fail(actual, expected, message, '===', assert.strictEqual);
  }
};

// 10. The strict non-equality assertion tests for strict inequality, as
// determined by !==.  assert.notStrictEqual(actual, expected, message_opt);

assert.notStrictEqual = function notStrictEqual(actual, expected, message) {
  if (actual === expected) {
    fail(actual, expected, message, '!==', assert.notStrictEqual);
  }
};

function expectedException(actual, expected) {
  if (!actual || !expected) {
    return false;
  }

  if (Object.prototype.toString.call(expected) == '[object RegExp]') {
    return expected.test(actual);
  } else if (actual instanceof expected) {
    return true;
  } else if (expected.call({}, actual) === true) {
    return true;
  }

  return false;
}

function _throws(shouldThrow, block, expected, message) {
  var actual;

  if (util.isString(expected)) {
    message = expected;
    expected = null;
  }

  try {
    block();
  } catch (e) {
    actual = e;
  }

  message = (expected && expected.name ? ' (' + expected.name + ').' : '.') +
            (message ? ' ' + message : '.');

  if (shouldThrow && !actual) {
    fail(actual, expected, 'Missing expected exception' + message);
  }

  if (!shouldThrow && expectedException(actual, expected)) {
    fail(actual, expected, 'Got unwanted exception' + message);
  }

  if ((shouldThrow && actual && expected &&
      !expectedException(actual, expected)) || (!shouldThrow && actual)) {
    throw actual;
  }
}

// 11. Expected to throw an error:
// assert.throws(block, Error_opt, message_opt);

assert.throws = function(block, /*optional*/error, /*optional*/message) {
  _throws.apply(this, [true].concat(pSlice.call(arguments)));
};

// EXTENSION! This is annoying to write outside this module.
assert.doesNotThrow = function(block, /*optional*/message) {
  _throws.apply(this, [false].concat(pSlice.call(arguments)));
};

assert.ifError = function(err) { if (err) {throw err;}};

var objectKeys = Object.keys || function (obj) {
  var keys = [];
  for (var key in obj) {
    if (hasOwn.call(obj, key)) keys.push(key);
  }
  return keys;
};

},{"util/":19}],15:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

function EventEmitter() {
  this._events = this._events || {};
  this._maxListeners = this._maxListeners || undefined;
}
module.exports = EventEmitter;

// Backwards-compat with node 0.10.x
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.prototype._events = undefined;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
EventEmitter.defaultMaxListeners = 10;

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function(n) {
  if (!isNumber(n) || n < 0 || isNaN(n))
    throw TypeError('n must be a positive number');
  this._maxListeners = n;
  return this;
};

EventEmitter.prototype.emit = function(type) {
  var er, handler, len, args, i, listeners;

  if (!this._events)
    this._events = {};

  // If there is no 'error' event listener then throw.
  if (type === 'error') {
    if (!this._events.error ||
        (isObject(this._events.error) && !this._events.error.length)) {
      er = arguments[1];
      if (er instanceof Error) {
        throw er; // Unhandled 'error' event
      }
      throw TypeError('Uncaught, unspecified "error" event.');
    }
  }

  handler = this._events[type];

  if (isUndefined(handler))
    return false;

  if (isFunction(handler)) {
    switch (arguments.length) {
      // fast cases
      case 1:
        handler.call(this);
        break;
      case 2:
        handler.call(this, arguments[1]);
        break;
      case 3:
        handler.call(this, arguments[1], arguments[2]);
        break;
      // slower
      default:
        len = arguments.length;
        args = new Array(len - 1);
        for (i = 1; i < len; i++)
          args[i - 1] = arguments[i];
        handler.apply(this, args);
    }
  } else if (isObject(handler)) {
    len = arguments.length;
    args = new Array(len - 1);
    for (i = 1; i < len; i++)
      args[i - 1] = arguments[i];

    listeners = handler.slice();
    len = listeners.length;
    for (i = 0; i < len; i++)
      listeners[i].apply(this, args);
  }

  return true;
};

EventEmitter.prototype.addListener = function(type, listener) {
  var m;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events)
    this._events = {};

  // To avoid recursion in the case that type === "newListener"! Before
  // adding it to the listeners, first emit "newListener".
  if (this._events.newListener)
    this.emit('newListener', type,
              isFunction(listener.listener) ?
              listener.listener : listener);

  if (!this._events[type])
    // Optimize the case of one listener. Don't need the extra array object.
    this._events[type] = listener;
  else if (isObject(this._events[type]))
    // If we've already got an array, just append.
    this._events[type].push(listener);
  else
    // Adding the second element, need to change to array.
    this._events[type] = [this._events[type], listener];

  // Check for listener leak
  if (isObject(this._events[type]) && !this._events[type].warned) {
    var m;
    if (!isUndefined(this._maxListeners)) {
      m = this._maxListeners;
    } else {
      m = EventEmitter.defaultMaxListeners;
    }

    if (m && m > 0 && this._events[type].length > m) {
      this._events[type].warned = true;
      console.error('(node) warning: possible EventEmitter memory ' +
                    'leak detected. %d listeners added. ' +
                    'Use emitter.setMaxListeners() to increase limit.',
                    this._events[type].length);
      if (typeof console.trace === 'function') {
        // not supported in IE 10
        console.trace();
      }
    }
  }

  return this;
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.once = function(type, listener) {
  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  var fired = false;

  function g() {
    this.removeListener(type, g);

    if (!fired) {
      fired = true;
      listener.apply(this, arguments);
    }
  }

  g.listener = listener;
  this.on(type, g);

  return this;
};

// emits a 'removeListener' event iff the listener was removed
EventEmitter.prototype.removeListener = function(type, listener) {
  var list, position, length, i;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events || !this._events[type])
    return this;

  list = this._events[type];
  length = list.length;
  position = -1;

  if (list === listener ||
      (isFunction(list.listener) && list.listener === listener)) {
    delete this._events[type];
    if (this._events.removeListener)
      this.emit('removeListener', type, listener);

  } else if (isObject(list)) {
    for (i = length; i-- > 0;) {
      if (list[i] === listener ||
          (list[i].listener && list[i].listener === listener)) {
        position = i;
        break;
      }
    }

    if (position < 0)
      return this;

    if (list.length === 1) {
      list.length = 0;
      delete this._events[type];
    } else {
      list.splice(position, 1);
    }

    if (this._events.removeListener)
      this.emit('removeListener', type, listener);
  }

  return this;
};

EventEmitter.prototype.removeAllListeners = function(type) {
  var key, listeners;

  if (!this._events)
    return this;

  // not listening for removeListener, no need to emit
  if (!this._events.removeListener) {
    if (arguments.length === 0)
      this._events = {};
    else if (this._events[type])
      delete this._events[type];
    return this;
  }

  // emit removeListener for all listeners on all events
  if (arguments.length === 0) {
    for (key in this._events) {
      if (key === 'removeListener') continue;
      this.removeAllListeners(key);
    }
    this.removeAllListeners('removeListener');
    this._events = {};
    return this;
  }

  listeners = this._events[type];

  if (isFunction(listeners)) {
    this.removeListener(type, listeners);
  } else {
    // LIFO order
    while (listeners.length)
      this.removeListener(type, listeners[listeners.length - 1]);
  }
  delete this._events[type];

  return this;
};

EventEmitter.prototype.listeners = function(type) {
  var ret;
  if (!this._events || !this._events[type])
    ret = [];
  else if (isFunction(this._events[type]))
    ret = [this._events[type]];
  else
    ret = this._events[type].slice();
  return ret;
};

EventEmitter.listenerCount = function(emitter, type) {
  var ret;
  if (!emitter._events || !emitter._events[type])
    ret = 0;
  else if (isFunction(emitter._events[type]))
    ret = 1;
  else
    ret = emitter._events[type].length;
  return ret;
};

function isFunction(arg) {
  return typeof arg === 'function';
}

function isNumber(arg) {
  return typeof arg === 'number';
}

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}

function isUndefined(arg) {
  return arg === void 0;
}

},{}],16:[function(require,module,exports){
if (typeof Object.create === 'function') {
  // implementation from standard node.js 'util' module
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    ctor.prototype = Object.create(superCtor.prototype, {
      constructor: {
        value: ctor,
        enumerable: false,
        writable: true,
        configurable: true
      }
    });
  };
} else {
  // old school shim for old browsers
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    var TempCtor = function () {}
    TempCtor.prototype = superCtor.prototype
    ctor.prototype = new TempCtor()
    ctor.prototype.constructor = ctor
  }
}

},{}],17:[function(require,module,exports){
// shim for using process in browser

var process = module.exports = {};
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = setTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    clearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        setTimeout(drainQueue, 0);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}],18:[function(require,module,exports){
module.exports = function isBuffer(arg) {
  return arg && typeof arg === 'object'
    && typeof arg.copy === 'function'
    && typeof arg.fill === 'function'
    && typeof arg.readUInt8 === 'function';
}
},{}],19:[function(require,module,exports){
(function (process,global){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

var formatRegExp = /%[sdj%]/g;
exports.format = function(f) {
  if (!isString(f)) {
    var objects = [];
    for (var i = 0; i < arguments.length; i++) {
      objects.push(inspect(arguments[i]));
    }
    return objects.join(' ');
  }

  var i = 1;
  var args = arguments;
  var len = args.length;
  var str = String(f).replace(formatRegExp, function(x) {
    if (x === '%%') return '%';
    if (i >= len) return x;
    switch (x) {
      case '%s': return String(args[i++]);
      case '%d': return Number(args[i++]);
      case '%j':
        try {
          return JSON.stringify(args[i++]);
        } catch (_) {
          return '[Circular]';
        }
      default:
        return x;
    }
  });
  for (var x = args[i]; i < len; x = args[++i]) {
    if (isNull(x) || !isObject(x)) {
      str += ' ' + x;
    } else {
      str += ' ' + inspect(x);
    }
  }
  return str;
};


// Mark that a method should not be used.
// Returns a modified function which warns once by default.
// If --no-deprecation is set, then it is a no-op.
exports.deprecate = function(fn, msg) {
  // Allow for deprecating things in the process of starting up.
  if (isUndefined(global.process)) {
    return function() {
      return exports.deprecate(fn, msg).apply(this, arguments);
    };
  }

  if (process.noDeprecation === true) {
    return fn;
  }

  var warned = false;
  function deprecated() {
    if (!warned) {
      if (process.throwDeprecation) {
        throw new Error(msg);
      } else if (process.traceDeprecation) {
        console.trace(msg);
      } else {
        console.error(msg);
      }
      warned = true;
    }
    return fn.apply(this, arguments);
  }

  return deprecated;
};


var debugs = {};
var debugEnviron;
exports.debuglog = function(set) {
  if (isUndefined(debugEnviron))
    debugEnviron = process.env.NODE_DEBUG || '';
  set = set.toUpperCase();
  if (!debugs[set]) {
    if (new RegExp('\\b' + set + '\\b', 'i').test(debugEnviron)) {
      var pid = process.pid;
      debugs[set] = function() {
        var msg = exports.format.apply(exports, arguments);
        console.error('%s %d: %s', set, pid, msg);
      };
    } else {
      debugs[set] = function() {};
    }
  }
  return debugs[set];
};


/**
 * Echos the value of a value. Trys to print the value out
 * in the best way possible given the different types.
 *
 * @param {Object} obj The object to print out.
 * @param {Object} opts Optional options object that alters the output.
 */
/* legacy: obj, showHidden, depth, colors*/
function inspect(obj, opts) {
  // default options
  var ctx = {
    seen: [],
    stylize: stylizeNoColor
  };
  // legacy...
  if (arguments.length >= 3) ctx.depth = arguments[2];
  if (arguments.length >= 4) ctx.colors = arguments[3];
  if (isBoolean(opts)) {
    // legacy...
    ctx.showHidden = opts;
  } else if (opts) {
    // got an "options" object
    exports._extend(ctx, opts);
  }
  // set default options
  if (isUndefined(ctx.showHidden)) ctx.showHidden = false;
  if (isUndefined(ctx.depth)) ctx.depth = 2;
  if (isUndefined(ctx.colors)) ctx.colors = false;
  if (isUndefined(ctx.customInspect)) ctx.customInspect = true;
  if (ctx.colors) ctx.stylize = stylizeWithColor;
  return formatValue(ctx, obj, ctx.depth);
}
exports.inspect = inspect;


// http://en.wikipedia.org/wiki/ANSI_escape_code#graphics
inspect.colors = {
  'bold' : [1, 22],
  'italic' : [3, 23],
  'underline' : [4, 24],
  'inverse' : [7, 27],
  'white' : [37, 39],
  'grey' : [90, 39],
  'black' : [30, 39],
  'blue' : [34, 39],
  'cyan' : [36, 39],
  'green' : [32, 39],
  'magenta' : [35, 39],
  'red' : [31, 39],
  'yellow' : [33, 39]
};

// Don't use 'blue' not visible on cmd.exe
inspect.styles = {
  'special': 'cyan',
  'number': 'yellow',
  'boolean': 'yellow',
  'undefined': 'grey',
  'null': 'bold',
  'string': 'green',
  'date': 'magenta',
  // "name": intentionally not styling
  'regexp': 'red'
};


function stylizeWithColor(str, styleType) {
  var style = inspect.styles[styleType];

  if (style) {
    return '\u001b[' + inspect.colors[style][0] + 'm' + str +
           '\u001b[' + inspect.colors[style][1] + 'm';
  } else {
    return str;
  }
}


function stylizeNoColor(str, styleType) {
  return str;
}


function arrayToHash(array) {
  var hash = {};

  array.forEach(function(val, idx) {
    hash[val] = true;
  });

  return hash;
}


function formatValue(ctx, value, recurseTimes) {
  // Provide a hook for user-specified inspect functions.
  // Check that value is an object with an inspect function on it
  if (ctx.customInspect &&
      value &&
      isFunction(value.inspect) &&
      // Filter out the util module, it's inspect function is special
      value.inspect !== exports.inspect &&
      // Also filter out any prototype objects using the circular check.
      !(value.constructor && value.constructor.prototype === value)) {
    var ret = value.inspect(recurseTimes, ctx);
    if (!isString(ret)) {
      ret = formatValue(ctx, ret, recurseTimes);
    }
    return ret;
  }

  // Primitive types cannot have properties
  var primitive = formatPrimitive(ctx, value);
  if (primitive) {
    return primitive;
  }

  // Look up the keys of the object.
  var keys = Object.keys(value);
  var visibleKeys = arrayToHash(keys);

  if (ctx.showHidden) {
    keys = Object.getOwnPropertyNames(value);
  }

  // IE doesn't make error fields non-enumerable
  // http://msdn.microsoft.com/en-us/library/ie/dww52sbt(v=vs.94).aspx
  if (isError(value)
      && (keys.indexOf('message') >= 0 || keys.indexOf('description') >= 0)) {
    return formatError(value);
  }

  // Some type of object without properties can be shortcutted.
  if (keys.length === 0) {
    if (isFunction(value)) {
      var name = value.name ? ': ' + value.name : '';
      return ctx.stylize('[Function' + name + ']', 'special');
    }
    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    }
    if (isDate(value)) {
      return ctx.stylize(Date.prototype.toString.call(value), 'date');
    }
    if (isError(value)) {
      return formatError(value);
    }
  }

  var base = '', array = false, braces = ['{', '}'];

  // Make Array say that they are Array
  if (isArray(value)) {
    array = true;
    braces = ['[', ']'];
  }

  // Make functions say that they are functions
  if (isFunction(value)) {
    var n = value.name ? ': ' + value.name : '';
    base = ' [Function' + n + ']';
  }

  // Make RegExps say that they are RegExps
  if (isRegExp(value)) {
    base = ' ' + RegExp.prototype.toString.call(value);
  }

  // Make dates with properties first say the date
  if (isDate(value)) {
    base = ' ' + Date.prototype.toUTCString.call(value);
  }

  // Make error with message first say the error
  if (isError(value)) {
    base = ' ' + formatError(value);
  }

  if (keys.length === 0 && (!array || value.length == 0)) {
    return braces[0] + base + braces[1];
  }

  if (recurseTimes < 0) {
    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    } else {
      return ctx.stylize('[Object]', 'special');
    }
  }

  ctx.seen.push(value);

  var output;
  if (array) {
    output = formatArray(ctx, value, recurseTimes, visibleKeys, keys);
  } else {
    output = keys.map(function(key) {
      return formatProperty(ctx, value, recurseTimes, visibleKeys, key, array);
    });
  }

  ctx.seen.pop();

  return reduceToSingleString(output, base, braces);
}


function formatPrimitive(ctx, value) {
  if (isUndefined(value))
    return ctx.stylize('undefined', 'undefined');
  if (isString(value)) {
    var simple = '\'' + JSON.stringify(value).replace(/^"|"$/g, '')
                                             .replace(/'/g, "\\'")
                                             .replace(/\\"/g, '"') + '\'';
    return ctx.stylize(simple, 'string');
  }
  if (isNumber(value))
    return ctx.stylize('' + value, 'number');
  if (isBoolean(value))
    return ctx.stylize('' + value, 'boolean');
  // For some reason typeof null is "object", so special case here.
  if (isNull(value))
    return ctx.stylize('null', 'null');
}


function formatError(value) {
  return '[' + Error.prototype.toString.call(value) + ']';
}


function formatArray(ctx, value, recurseTimes, visibleKeys, keys) {
  var output = [];
  for (var i = 0, l = value.length; i < l; ++i) {
    if (hasOwnProperty(value, String(i))) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
          String(i), true));
    } else {
      output.push('');
    }
  }
  keys.forEach(function(key) {
    if (!key.match(/^\d+$/)) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
          key, true));
    }
  });
  return output;
}


function formatProperty(ctx, value, recurseTimes, visibleKeys, key, array) {
  var name, str, desc;
  desc = Object.getOwnPropertyDescriptor(value, key) || { value: value[key] };
  if (desc.get) {
    if (desc.set) {
      str = ctx.stylize('[Getter/Setter]', 'special');
    } else {
      str = ctx.stylize('[Getter]', 'special');
    }
  } else {
    if (desc.set) {
      str = ctx.stylize('[Setter]', 'special');
    }
  }
  if (!hasOwnProperty(visibleKeys, key)) {
    name = '[' + key + ']';
  }
  if (!str) {
    if (ctx.seen.indexOf(desc.value) < 0) {
      if (isNull(recurseTimes)) {
        str = formatValue(ctx, desc.value, null);
      } else {
        str = formatValue(ctx, desc.value, recurseTimes - 1);
      }
      if (str.indexOf('\n') > -1) {
        if (array) {
          str = str.split('\n').map(function(line) {
            return '  ' + line;
          }).join('\n').substr(2);
        } else {
          str = '\n' + str.split('\n').map(function(line) {
            return '   ' + line;
          }).join('\n');
        }
      }
    } else {
      str = ctx.stylize('[Circular]', 'special');
    }
  }
  if (isUndefined(name)) {
    if (array && key.match(/^\d+$/)) {
      return str;
    }
    name = JSON.stringify('' + key);
    if (name.match(/^"([a-zA-Z_][a-zA-Z_0-9]*)"$/)) {
      name = name.substr(1, name.length - 2);
      name = ctx.stylize(name, 'name');
    } else {
      name = name.replace(/'/g, "\\'")
                 .replace(/\\"/g, '"')
                 .replace(/(^"|"$)/g, "'");
      name = ctx.stylize(name, 'string');
    }
  }

  return name + ': ' + str;
}


function reduceToSingleString(output, base, braces) {
  var numLinesEst = 0;
  var length = output.reduce(function(prev, cur) {
    numLinesEst++;
    if (cur.indexOf('\n') >= 0) numLinesEst++;
    return prev + cur.replace(/\u001b\[\d\d?m/g, '').length + 1;
  }, 0);

  if (length > 60) {
    return braces[0] +
           (base === '' ? '' : base + '\n ') +
           ' ' +
           output.join(',\n  ') +
           ' ' +
           braces[1];
  }

  return braces[0] + base + ' ' + output.join(', ') + ' ' + braces[1];
}


// NOTE: These type checking functions intentionally don't use `instanceof`
// because it is fragile and can be easily faked with `Object.create()`.
function isArray(ar) {
  return Array.isArray(ar);
}
exports.isArray = isArray;

function isBoolean(arg) {
  return typeof arg === 'boolean';
}
exports.isBoolean = isBoolean;

function isNull(arg) {
  return arg === null;
}
exports.isNull = isNull;

function isNullOrUndefined(arg) {
  return arg == null;
}
exports.isNullOrUndefined = isNullOrUndefined;

function isNumber(arg) {
  return typeof arg === 'number';
}
exports.isNumber = isNumber;

function isString(arg) {
  return typeof arg === 'string';
}
exports.isString = isString;

function isSymbol(arg) {
  return typeof arg === 'symbol';
}
exports.isSymbol = isSymbol;

function isUndefined(arg) {
  return arg === void 0;
}
exports.isUndefined = isUndefined;

function isRegExp(re) {
  return isObject(re) && objectToString(re) === '[object RegExp]';
}
exports.isRegExp = isRegExp;

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}
exports.isObject = isObject;

function isDate(d) {
  return isObject(d) && objectToString(d) === '[object Date]';
}
exports.isDate = isDate;

function isError(e) {
  return isObject(e) &&
      (objectToString(e) === '[object Error]' || e instanceof Error);
}
exports.isError = isError;

function isFunction(arg) {
  return typeof arg === 'function';
}
exports.isFunction = isFunction;

function isPrimitive(arg) {
  return arg === null ||
         typeof arg === 'boolean' ||
         typeof arg === 'number' ||
         typeof arg === 'string' ||
         typeof arg === 'symbol' ||  // ES6 symbol
         typeof arg === 'undefined';
}
exports.isPrimitive = isPrimitive;

exports.isBuffer = require('./support/isBuffer');

function objectToString(o) {
  return Object.prototype.toString.call(o);
}


function pad(n) {
  return n < 10 ? '0' + n.toString(10) : n.toString(10);
}


var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep',
              'Oct', 'Nov', 'Dec'];

// 26 Feb 16:19:34
function timestamp() {
  var d = new Date();
  var time = [pad(d.getHours()),
              pad(d.getMinutes()),
              pad(d.getSeconds())].join(':');
  return [d.getDate(), months[d.getMonth()], time].join(' ');
}


// log is just a thin wrapper to console.log that prepends a timestamp
exports.log = function() {
  console.log('%s - %s', timestamp(), exports.format.apply(exports, arguments));
};


/**
 * Inherit the prototype methods from one constructor into another.
 *
 * The Function.prototype.inherits from lang.js rewritten as a standalone
 * function (not on Function.prototype). NOTE: If this file is to be loaded
 * during bootstrapping this function needs to be rewritten using some native
 * functions as prototype setup using normal JavaScript does not work as
 * expected during bootstrapping (see mirror.js in r114903).
 *
 * @param {function} ctor Constructor function which needs to inherit the
 *     prototype.
 * @param {function} superCtor Constructor function to inherit prototype from.
 */
exports.inherits = require('inherits');

exports._extend = function(origin, add) {
  // Don't do anything if add isn't an object
  if (!add || !isObject(add)) return origin;

  var keys = Object.keys(add);
  var i = keys.length;
  while (i--) {
    origin[keys[i]] = add[keys[i]];
  }
  return origin;
};

function hasOwnProperty(obj, prop) {
  return Object.prototype.hasOwnProperty.call(obj, prop);
}

}).call(this,require('_process'),typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"./support/isBuffer":18,"_process":17,"inherits":16}],20:[function(require,module,exports){
var assert = require("assert");
var http   = require("../client");

var _uid = 0;
function uid () { return _uid++; }

function createEl (tag, attrs) {
	var el = document.createElement(tag);
	for (var name in attrs) el.setAttribute(name, attrs[name]);
	document.body.appendChild(el);
	return el;
}

function clickEl (el) {
    var ev = document.createEvent("MouseEvent");
    ev.initMouseEvent("click", true, true, window, null, 0, 0, 0, 0, false, false, false, false, 0 , null);
    el.dispatchEvent(ev);
};

function onClick (el, fn, allowDefault) {
	window.addEventListener("click", function _handleClick (e) {
		if (!allowDefault) e.preventDefault();
		window.removeEventListener("click", _handleClick);
	});
	el.addEventListener("click", fn);
}

function afterClick (el, fn, allowDefault) {
	onClick(el, function () { setTimeout(function () { fn() }, 1); }, allowDefault);
}

function onSubmit (el, fn, allowDefault) {
	window.addEventListener("submit", function _handleSubmit (e) {
		if (!allowDefault) e.preventDefault();
		window.removeEventListener("submit", _handleSubmit);
	});
	el.addEventListener("submit", fn);
}

function afterSubmit (el, fn, allowDefault) {
	onSubmit(el, function () { setTimeout(function () { fn() }, 1); }, allowDefault);
}

describe("HTTP", function () {
	describe("Links", function () {
		var server = http.createServer(function (req, res) { res.end(); }).listen();
		afterEach(function () { document.body.innerHTML = ""; });
		after(function () { server.close() });

		it("should handle internal links", function (done) {
			var testURL = "/test-" + uid();
			var el      = createEl("a", { href: testURL });

			assert.ok(location.path !== el.href);

			afterClick(el, function (e) {
				assert.ok(location.href === el.href);
				done();
			}, true);

			clickEl(el);
		});

		it("should ignore default prevented clicks", function (done) {
			var testURL = "/test-" + uid();
			var el      = createEl("a", { href: testURL });

			assert.ok(location.path !== el.href);

			onClick(el, function (e) { e.preventDefault(); })
			afterClick(el, function (e) {
				assert.ok(location.href !== el.href);
				done();
			});

			clickEl(el);
		});

		it("should ignore links without an href", function (done) {
			var el = createEl("a", {});

			onClick(el, function (e) {
				assert.ok(!e.defaultPrevented);
				assert.ok(location.href !== el.href);
				done();
			});

			clickEl(el);
		});

		it("should ignore rel external links", function (done) {
			var el = createEl("a", { href: "/", rel: "external" });

			onClick(el, function (e) {
				assert.ok(!e.defaultPrevented);
				assert.ok(location.href !== el.href);
				done();
			});

			clickEl(el);
		});

		it("should ignore target links", function (done) {
			var el = createEl("a", { href: "/", target: "_blank" });

			onClick(el, function (e) {
				assert.ok(!e.defaultPrevented);
				assert.ok(location.href !== el.href);
				done();
			});

			clickEl(el);
		});

		it("should ignore different protocol links", function (done) {
			var el = createEl("a", { href: "https://localhost:8000/" });

			onClick(el, function (e) {
				assert.ok(!e.defaultPrevented);
				assert.ok(location.href !== el.href);
				done();
			});

			clickEl(el);
		});

		it("should ignore links with a different host", function (done) {
			var el = createEl("a", { href: "http://google.ca" });

			assert.ok(location.path !== el.href);

			onClick(el, function (e) {
				assert.ok(!e.defaultPrevented);
				assert.ok(location.href !== el.href);
				done();
			});

			clickEl(el);
		});
	});

	describe("Forms", function () {
		var formData;
		var formQuery;
		var server = http.createServer(function (req, res) {
			formData = req.body;
			formURL  = req.url;
			res.end();
		}).listen();
		afterEach(function () {
			formData                = 
			formURL                 = undefined;
			document.body.innerHTML = "";
		});
		after(function () { server.close() });

		it("should handle internal body forms", function (done) {
			var testURL = "/test-" + uid();
			var el      = createEl("form", { action: testURL, method: "POST" });
			var input   = createEl("input", { name: "test", value: "1" });
			var submit  = createEl("button", { type: "submit" });
			el.appendChild(input);
			el.appendChild(submit);

			afterSubmit(el, function () {
				assert.ok(formData.test);
				done();
			});

			clickEl(submit);
		});

		it("should handle internal GET forms with querystring", function (done) {
			var testURL = "/test-" + uid();
			var el      = createEl("form", { action: testURL, method: "GET" });
			var input   = createEl("input", { name: "test", value: "1" });
			var submit  = createEl("button", { type: "submit" });
			el.appendChild(input);
			el.appendChild(submit);

			afterSubmit(el, function () {
				assert.ok(formURL.indexOf(JSON.stringify({ test: "1" })) !== -1);
				done();
			});

			clickEl(submit);
		});

		it("should ignore default prevented clicks", function (done) {
			var testURL = "/test-" + uid();
			var el      = createEl("form", { action: testURL, method: "POST" });
			var input   = createEl("input", { name: "test", value: "1" });
			var submit  = createEl("button", { type: "submit" });
			el.appendChild(input);
			el.appendChild(submit);

			onSubmit(el, function (e) { e.preventDefault(); }, true);
			afterSubmit(el, function () {
				assert.equal(formData, undefined);
				done();
			});

			clickEl(submit);
		});

		it("should ignore forms without an action", function (done) {
			var el      = createEl("form", { method: "POST" });
			var input   = createEl("input", { name: "test", value: "1" });
			var submit  = createEl("button", { type: "submit" });
			el.appendChild(input);
			el.appendChild(submit);

			onSubmit(el, function () {
				assert.equal(formData, undefined);
				done();
			});

			clickEl(submit);
		});

		it("should ignore rel external forms", function (done) {
			var testURL = "/test-" + uid();
			var el      = createEl("form", { action: testURL, method: "POST", rel: "external" });
			var input   = createEl("input", { name: "test", value: "1" });
			var submit  = createEl("button", { type: "submit" });
			el.appendChild(input);
			el.appendChild(submit);

			afterSubmit(el, function () {
				assert.equal(formData, undefined);
				done();
			});

			clickEl(submit);
		});

		it("should ignore target forms", function (done) {
			var testURL = "/test-" + uid();
			var el      = createEl("form", { action: testURL, method: "POST", target: "_blank" });
			var input   = createEl("input", { name: "test", value: "1" });
			var submit  = createEl("button", { type: "submit" });
			el.appendChild(input);
			el.appendChild(submit);

			afterSubmit(el, function () {
				assert.equal(formData, undefined);
				done();
			});

			clickEl(submit);
		});

		it("should ignore different protocol forms", function (done) {
			var el      = createEl("form", { action: "https://localhost:8000/", method: "POST" });
			var input   = createEl("input", { name: "test", value: "1" });
			var submit  = createEl("button", { type: "submit" });
			el.appendChild(input);
			el.appendChild(submit);

			afterSubmit(el, function () {
				assert.equal(formData, undefined);
				done();
			});

			clickEl(submit);
		});

		it("should ignore links with a different host", function (done) {
			var el      = createEl("form", { action: "http://google.ca", method: "POST" });
			var input   = createEl("input", { name: "test", value: "1" });
			var submit  = createEl("button", { type: "submit" });
			el.appendChild(input);
			el.appendChild(submit);

			afterSubmit(el, function () {
				assert.equal(formData, undefined);
				done();
			});

			clickEl(submit);
		});
	});
});
},{"../client":1,"assert":14}]},{},[20])
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJjbGllbnQvaW5kZXguanMiLCJjbGllbnQvcmVxdWVzdC5qcyIsImNsaWVudC9yZXNwb25zZS5qcyIsImNsaWVudC9zZXJ2ZXIuanMiLCJub2RlX21vZHVsZXMvQHJpbGwvZm9ybS1qc29uL2xpYi9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9AcmlsbC9wYXJzZS11cmwvY2xpZW50L2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL0ByaWxsL3BhcnNlLXVybC9ub2RlX21vZHVsZXMvdXJsbGl0ZS9saWIvY29tcGxldGUuanMiLCJub2RlX21vZHVsZXMvQHJpbGwvcGFyc2UtdXJsL25vZGVfbW9kdWxlcy91cmxsaXRlL2xpYi9jb3JlLmpzIiwibm9kZV9tb2R1bGVzL0ByaWxsL3BhcnNlLXVybC9ub2RlX21vZHVsZXMvdXJsbGl0ZS9saWIvZXh0ZW5zaW9ucy9ub3JtYWxpemUuanMiLCJub2RlX21vZHVsZXMvQHJpbGwvcGFyc2UtdXJsL25vZGVfbW9kdWxlcy91cmxsaXRlL2xpYi9leHRlbnNpb25zL3JlbGF0aXZpemUuanMiLCJub2RlX21vZHVsZXMvQHJpbGwvcGFyc2UtdXJsL25vZGVfbW9kdWxlcy91cmxsaXRlL2xpYi9leHRlbnNpb25zL3Jlc29sdmUuanMiLCJub2RlX21vZHVsZXMvQHJpbGwvcGFyc2UtdXJsL25vZGVfbW9kdWxlcy91cmxsaXRlL2xpYi9leHRlbnNpb25zL3RvU3RyaW5nLmpzIiwibm9kZV9tb2R1bGVzL0ByaWxsL3BhcnNlLXVybC9ub2RlX21vZHVsZXMvdXJsbGl0ZS9ub2RlX21vZHVsZXMveHRlbmQvaW1tdXRhYmxlLmpzIiwibm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Fzc2VydC9hc3NlcnQuanMiLCJub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvZXZlbnRzL2V2ZW50cy5qcyIsIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9pbmhlcml0cy9pbmhlcml0c19icm93c2VyLmpzIiwibm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL3Byb2Nlc3MvYnJvd3Nlci5qcyIsIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy91dGlsL3N1cHBvcnQvaXNCdWZmZXJCcm93c2VyLmpzIiwibm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL3V0aWwvdXRpbC5qcyIsInRlc3QvbWFpblRlc3QuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1BBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDekJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbENBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzVNQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM1R0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDakJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2V0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM3U0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3ZCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzNGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQ0xBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUMxa0JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsInZhciBTZXJ2ZXIgPSByZXF1aXJlKFwiLi9zZXJ2ZXJcIik7XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuXHRTZXJ2ZXI6IFNlcnZlcixcblx0Y3JlYXRlU2VydmVyOiBmdW5jdGlvbiBjcmVhdGVTZXJ2ZXIgKGhhbmRsZXIpIHtcblx0XHRyZXR1cm4gbmV3IFNlcnZlcihoYW5kbGVyKTtcblx0fVxufTsiLCJ2YXIgRXZlbnRFbWl0dGVyID0gcmVxdWlyZShcImV2ZW50c1wiKS5FdmVudEVtaXR0ZXI7XG52YXIgcmVmZXJyZXIgICAgID0gZG9jdW1lbnQucmVmZXJyZXI7XG5cbmZ1bmN0aW9uIEluY29taW5nTWVzc2FnZSAob3B0cykge1xuXHR0aGlzLnVybCAgICAgICAgICAgICAgICAgICAgICAgID0gb3B0cy51cmw7XG5cdHRoaXMubWV0aG9kICAgICAgICAgICAgICAgICAgICAgPSBvcHRzLm1ldGhvZCB8fCBcIkdFVFwiO1xuXHR0aGlzLmhlYWRlcnMgICAgICAgICAgICAgICAgICAgID0gb3B0cy5oZWFkZXJzIHx8IHt9O1xuXHR0aGlzLmhlYWRlcnNbXCJob3N0XCJdICAgICAgICAgICAgPSBsb2NhdGlvbi5ob3N0O1xuXHR0aGlzLmhlYWRlcnNbXCJjb29raWVcIl0gICAgICAgICAgPSBkb2N1bWVudC5jb29raWU7XG5cdHRoaXMuaGVhZGVyc1tcInVzZXItYWdlbnRcIl0gICAgICA9IG5hdmlnYXRvci51c2VyQWdlbnQ7XG5cdHRoaXMuaGVhZGVyc1tcImFjY2VwdC1sYW5ndWFnZVwiXSA9IG5hdmlnYXRvci5sYW5ndWFnZTtcblx0dGhpcy5oZWFkZXJzW1wicmVmZXJlclwiXSAgICAgICAgID0gcmVmZXJyZXI7XG5cdHRoaXMuY29ubmVjdGlvbiAgICAgICAgICAgICAgICAgPSB7XG5cdFx0cmVtb3RlQWRkcmVzczogXCIxMjcuMC4wLjFcIixcblx0XHRlbmNyeXB0ZWQ6IGxvY2F0aW9uLnByb3RvY29sID09PSBcImh0dHBzOlwiXG5cdH07XG5cdHRoaXMuYm9keSA9IG9wdHMuYm9keTtcblx0dGhpcy5maWxlcyA9IG9wdHMuZmlsZXM7XG5cdHJlZmVycmVyID0gb3B0cy51cmw7XG59XG52YXIgcHJvdG8gPSBJbmNvbWluZ01lc3NhZ2UucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShFdmVudEVtaXR0ZXIucHJvdG90eXBlKTtcblxuLy8gRGVmYXVsdHNcbnByb3RvLmNvbXBsZXRlID0gZmFsc2U7XG5cbm1vZHVsZS5leHBvcnRzID0gSW5jb21pbmdNZXNzYWdlOyIsInZhciBFdmVudEVtaXR0ZXIgPSByZXF1aXJlKFwiZXZlbnRzXCIpLkV2ZW50RW1pdHRlcjtcbnZhciBub29wICAgICAgICAgPSBmdW5jdGlvbiAoKSB7fTtcblxuZnVuY3Rpb24gU2VydmVyUmVzcG9uc2UgKG9wdHMpIHtcblx0dGhpcy5oZWFkZXJzID0ge307XG59XG52YXIgcHJvdG8gPSBTZXJ2ZXJSZXNwb25zZS5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKEV2ZW50RW1pdHRlci5wcm90b3R5cGUpO1xuXG4vLyBEZWZhdWx0cy5cbnByb3RvLnN0YXR1c0NvZGUgICAgPSBudWxsO1xucHJvdG8uc3RhdHVzTWVzc2FnZSA9IG51bGw7XG5wcm90by5zZW5kRGF0ZSAgICAgID0gdHJ1ZTtcbnByb3RvLmZpbmlzaGVkICAgICAgPSBmYWxzZTtcblxuLyoqXG4gKiBNYWtlIHNvbWUgbWV0aG9kcyBub29wcy5cbiAqL1xucHJvdG8ud3JpdGUgICAgICAgICA9IFxucHJvdG8ud3JpdGVIZWFkICAgICA9IFxucHJvdG8ud3JpdGVDb250aW51ZSA9IFxucHJvdG8uc2V0VGltZW91dCAgICA9IFxucHJvdG8uc2V0SGVhZGVyICAgICA9IFxucHJvdG8uZ2V0SGVhZGVyICAgICA9IFxucHJvdG8ucmVtb3ZlSGVhZGVyICA9IFxucHJvdG8uYWRkVHJhaWxlcnMgICA9IG5vb3A7XG5cbi8qKlxuICogSGFuZGxlIGV2ZW50IGVuZGluZyB0aGUgc2FtZSBhcyBub2RlIGpzLlxuICovXG5wcm90by5lbmQgPSBmdW5jdGlvbiBlbmQgKCkge1xuXHR0aGlzLmZpbmlzaGVkID0gdHJ1ZTtcblx0dGhpcy5lbWl0KFwiZmluaXNoXCIpO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBTZXJ2ZXJSZXNwb25zZTsiLCJ2YXIgRXZlbnRFbWl0dGVyID0gcmVxdWlyZShcImV2ZW50c1wiKTtcbnZhciBzZXJpYWxpemUgICAgPSByZXF1aXJlKFwiQHJpbGwvZm9ybS1qc29uXCIpO1xudmFyIHBhcnNlVVJMICAgICA9IHJlcXVpcmUoXCJAcmlsbC9wYXJzZS11cmxcIik7XG52YXIgUmVxdWVzdCAgICAgID0gcmVxdWlyZShcIi4vcmVxdWVzdC5qc1wiKTtcbnZhciBSZXNwb25zZSAgICAgPSByZXF1aXJlKFwiLi9yZXNwb25zZS5qc1wiKTtcbnZhciByZWcgICAgICAgICAgPSB7XG5cdGhhc2g6IC8jLiskLyxcblx0cmVsOiAgLyg/Ol58XFxzKylleHRlcm5hbCg/Olxccyt8JCkvXG59O1xuXG4vKipcbiAqIEVtdWxhdGVzIG5vZGUganMgaHR0cCBzZXJ2ZXIgaW4gdGhlIGJyb3dzZXIuXG4gKlxuICogQHBhcmFtIHtGdW5jdGlvbn0gaGFuZGxlIC0gdGhlIGhhbmRsZSBmb3IgYSByZXF1ZXN0LlxuICovXG5mdW5jdGlvbiBTZXJ2ZXIgKGhhbmRsZXIpIHtcblx0dGhpcy5fc3RhcnRlZCA9IGZhbHNlO1xuXHR0aGlzLl9oYW5kbGVyID0gaGFuZGxlcjtcblx0dGhpcy5faGFuZGxlICA9IHRoaXM7XG59XG52YXIgcHJvdG8gPSBTZXJ2ZXIucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShFdmVudEVtaXR0ZXIucHJvdG90eXBlKTtcblxuLyoqXG4gKiBMaXN0ZW4gdG8gYWxsIHVybCBjaGFuZ2UgZXZlbnRzIG9uIGEgZG9tIGVsZW1lbnQgYW5kIHRyaWdnZXIgdGhlIHNlcnZlciBjYWxsYmFjay5cbiAqL1xucHJvdG8ubGlzdGVuID0gZnVuY3Rpb24gbGlzdGVuICgpIHtcblx0dmFyIGNiICAgICAgICAgICAgPSBhcmd1bWVudHNbYXJndW1lbnRzLmxlbmd0aCAtIDFdO1xuXHR0aGlzLl9vblVSTENoYW5nZSA9IG9uVVJMQ2hhbmdlLmJpbmQodGhpcyk7XG5cdHRoaXMuX29uU3VibWl0ICAgID0gb25TdWJtaXQuYmluZCh0aGlzKTtcblx0dGhpcy5fb25DbGljayAgICAgPSBvbkNsaWNrLmJpbmQodGhpcyk7XG5cblx0d2luZG93LmFkZEV2ZW50TGlzdGVuZXIoXCJET01Db250ZW50TG9hZGVkXCIsIHRoaXMuX29uVVJMQ2hhbmdlKTtcblx0d2luZG93LmFkZEV2ZW50TGlzdGVuZXIoXCJwb3BzdGF0ZVwiLCB0aGlzLl9vblVSTENoYW5nZSk7XG5cdHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKFwic3VibWl0XCIsIHRoaXMuX29uU3VibWl0KTtcblx0d2luZG93LmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCB0aGlzLl9vbkNsaWNrKTtcblxuXHRpZiAodHlwZW9mIGNhbGxiYWNrID09PSBcImZ1bmN0aW9uXCIpIHNldFRpbWVvdXQoY2IsIDApO1xuXHRyZXR1cm4gdGhpcztcbn07XG5cbi8qKlxuICogQ2xvc2VzIHRoZSBzZXJ2ZXIgYW5kIGRlc3Ryb3lzIGFsbCBldmVudCBsaXN0ZW5lcnMuXG4gKi9cbnByb3RvLmNsb3NlID0gZnVuY3Rpb24gY2xvc2UgKCkge1xuXHR2YXIgY2IgPSBhcmd1bWVudHNbYXJndW1lbnRzLmxlbmd0aCAtIDFdO1xuXG5cdHdpbmRvdy5yZW1vdmVFdmVudExpc3RlbmVyKFwiRE9NQ29udGVudExvYWRlZFwiLCB0aGlzLl9vblVSTENoYW5nZSk7XG5cdHdpbmRvdy5yZW1vdmVFdmVudExpc3RlbmVyKFwicG9wc3RhdGVcIiwgdGhpcy5fb25VUkxDaGFuZ2UpO1xuXHR3aW5kb3cucmVtb3ZlRXZlbnRMaXN0ZW5lcihcInN1Ym1pdFwiLCB0aGlzLl9vblN1Ym1pdCk7XG5cdHdpbmRvdy5yZW1vdmVFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgdGhpcy5fb25DbGljayk7XG5cblx0aWYgKHR5cGVvZiBjYWxsYmFjayA9PT0gXCJmdW5jdGlvblwiKSBzZXRUaW1lb3V0KGRiLCAwKTtcblx0dGhpcy5lbWl0KFwiY2xvc2VcIik7XG5cdHJldHVybiB0aGlzO1xufTtcblxuLypcbiAqIFRyaWdnZXIgdGhlIHJlZ2lzdGVyZWQgaGFuZGxlIHRvIG5hdmlnYXRlIHRvIGEgZ2l2ZW4gdXJsLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfE9iamVjdH0gcmVxXG4gKiBAcGFyYW0ge0Jvb2xlYW59IHJlcGxhY2VTdGF0ZVxuICogQGFwaSBwcml2YXRlXG4gKi9cbnByb3RvLm5hdmlnYXRlID0gZnVuY3Rpb24gbmF2aWdhdGUgKG9wdHMsIHJlcGxhY2VTdGF0ZSkge1xuXHRpZiAodHlwZW9mIG9wdHMgPT09IFwic3RyaW5nXCIpIG9wdHMgPSB7IHVybDogb3B0cyB9O1xuXG5cdHZhciBzZWxmID0gdGhpcztcblx0dmFyIHJlcSAgPSBuZXcgUmVxdWVzdChvcHRzKTtcblx0dmFyIHJlcyAgPSBuZXcgUmVzcG9uc2UoKTtcblxuXHRyZXMub25jZShcImZpbmlzaFwiLCBmdW5jdGlvbiBvbkVuZCgpIHtcblx0XHRyZXEuY29tcGxldGUgPSB0cnVlO1xuXHRcdHJlcS5lbWl0KFwiZmluc2lzaFwiKTtcblx0XHQvLyBDaGVjayB0byBzZWUgaWYgd2Ugc2hvdWxkIHVwZGF0ZSB0aGUgdXJsLlxuXHRcdGlmIChyZXEubWV0aG9kICE9PSBcIkdFVFwiIHx8IHJlcy5oZWFkZXJzW1wibG9jYXRpb25cIl0pIHJldHVybjtcblxuXHRcdHZhciBoYXNoID0gcmVxLnVybC5tYXRjaChyZWcuaGFzaCk7XG5cdFx0aGFzaCAgICAgPSBoYXNoID8gaGFzaFswXSA6IG51bGw7XG5cblx0XHQvKlxuXHRcdCAqIFdoZW4gbmF2aWdhdGluZyBhIHVzZXIgd2lsbCBiZSBicm91Z2h0IHRvIHRoZSB0b3Agb2YgdGhlIHBhZ2UuXG5cdFx0ICogSWYgdGhlIHVybHMgY29udGFpbnMgYSBoYXNoIHRoYXQgaXMgdGhlIGlkIG9mIGFuIGVsZW1lbnQgKGEgdGFyZ2V0KSB0aGVuIHRoZSB0YXJnZXQgd2lsbCBiZSBzY3JvbGxlZCB0by5cblx0XHQgKiBUaGlzIGlzIHNpbWlsYXIgdG8gaG93IGJyb3dzZXJzIGhhbmRsZSBwYWdlIHRyYW5zaXRpb25zIG5hdGl2ZWx5LlxuXHRcdCAqL1xuXHRcdGlmIChoYXNoICE9IG51bGwpIHtcblx0XHRcdHRhcmdldCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKGhhc2guc2xpY2UoMSkpO1xuXHRcdFx0aWYgKHRhcmdldCkgdGFyZ2V0LnNjcm9sbEludG9WaWV3KHsgYmxvY2s6IFwic3RhcnRcIiwgYmVoYXZpb3I6IFwic21vb3RoXCIgfSk7XG5cdFx0fSBlbHNlIGlmIChzZWxmLl9zdGFydGVkKSB7XG5cdFx0XHR3aW5kb3cuc2Nyb2xsVG8oMCwgMCk7XG5cdFx0fVxuXG5cdFx0c2VsZi5fc3RhcnRlZCA9IHRydWU7XG5cblx0XHRoaXN0b3J5W3JlcGxhY2VTdGF0ZVxuXHRcdFx0PyBcInJlcGxhY2VTdGF0ZVwiXG5cdFx0XHQ6IFwicHVzaFN0YXRlXCJcblx0XHRdKG51bGwsIFwiXCIsIHJlcS51cmwpO1xuXHR9KTtcblxuXHR0aGlzLmVtaXQoXCJyZXF1ZXN0XCIsIHJlcSwgcmVzKTtcblx0dGhpcy5faGFuZGxlcihyZXEsIHJlcyk7XG5cdHJldHVybiB0aGlzO1xufTtcblxuLypcbiAqIEhhbmRsZSBhbiBldmVudCB0aGF0IGNoYW5nZWQgdGhlIHVybCAocG9wc3RhdGUgb3IgcGFnZSBsb2FkKS5cbiAqXG4gKiBAcGFyYW0ge09iamVjdH0gZXZlbnRcbiAqL1xuZnVuY3Rpb24gb25VUkxDaGFuZ2UgKGUpIHtcblx0dGhpcy5uYXZpZ2F0ZShsb2NhdGlvbi5ocmVmLCB0cnVlKTtcbn07XG5cbi8qXG4gKiBIYW5kbGUgaW50ZXJjZXB0aW5nIGZvcm1zIHRvIHVwZGF0ZSB0aGUgdXJsLlxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSBldmVudFxuICovXG5mdW5jdGlvbiBvblN1Ym1pdCAoZSkge1xuXHQvLyBJZ25vcmUgY2FuY2VsZWQgZXZlbnRzLlxuXHRpZiAoZS5kZWZhdWx0UHJldmVudGVkKSByZXR1cm47XG5cblx0Ly8gR2V0IHRoZSA8Zm9ybT4gZWxlbWVudC5cblx0dmFyIGVsID0gZXZlbnQudGFyZ2V0O1xuXG5cdC8vIElnbm9yZSBjbGlja3MgZnJvbSBsaW5rbGVzcyBlbGVtZW50c1xuXHRpZiAoIWVsLmFjdGlvbikgcmV0dXJuO1xuXG5cdHZhciB1cmwgPSBlbC5hY3Rpb247XG5cdC8vIElnbm9yZSB0aGUgY2xpY2sgaWYgdGhlIGVsZW1lbnQgaGFzIGEgdGFyZ2V0LlxuXHRpZiAoZWwudGFyZ2V0ICYmIGVsLnRhcmdldCAhPT0gXCJfc2VsZlwiKSByZXR1cm47XG5cdC8vIElnbm9yZSAncmVsPVwiZXh0ZXJuYWxcIicgbGlua3MuXG5cdGlmIChlbC5oYXNBdHRyaWJ1dGUoXCJyZWxcIikgJiYgcmVnLnJlbC50ZXN0KGVsLmdldEF0dHJpYnV0ZShcInJlbFwiKSkpIHJldHVybjtcblxuXHQvLyBVc2UgYSB1cmwgcGFyc2VyIHRvIHBhcnNlIFVSTHMgaW5zdGVhZCBvZiByZWx5aW5nIG9uIHRoZSBicm93c2VyXG5cdC8vIHRvIGRvIGl0IGZvciB1cyAoYmVjYXVzZSBJRSkuXG5cdHZhciBwYXJzZWQgPSBwYXJzZVVSTCh1cmwpO1xuXHQvLyBJZ25vcmUgbGlua3MgdGhhdCBkb24ndCBzaGFyZSBhIHByb3RvY29sIHdpdGggdGhlIGJyb3dzZXJzLlxuXHRpZiAobG9jYXRpb24ucHJvdG9jb2wuaW5kZXhPZihwYXJzZWQucHJvdG9jb2wpID09PSAtMSkgcmV0dXJuO1xuXHQvLyBJZ25vcmUgbGlua3MgdGhhdCBkb24ndCBzaGFyZSBhIGhvc3Qgd2l0aCB0aGUgYnJvd3NlcnMuXG5cdGlmIChsb2NhdGlvbi5ob3N0ICE9PSBwYXJzZWQuaG9zdCkgcmV0dXJuO1xuXG5cdHZhciBzZXJpYWxpemVkID0gc2VyaWFsaXplKGVsKTtcblx0dmFyIG1ldGhvZCA9IChlbC5nZXRBdHRyaWJ1dGUoXCJtZXRob2RcIikgfHwgZWwubWV0aG9kKS50b1VwcGVyQ2FzZSgpO1xuXHRcblx0aWYgKG1ldGhvZCA9PT0gXCJHRVRcIikge1xuXHRcdC8vIElnbm9yZSBxcyB3aGVuIHVzaW5nIEdFVCAoY29uc2lzdGVudCB3aXRoIGJyb3dzZXJzKS5cblx0XHR0aGlzLm5hdmlnYXRlKHVybC5zcGxpdChcIj9cIilbMF0gKyBcIj9cIiArIEpTT04uc3RyaW5naWZ5KHNlcmlhbGl6ZWQuYm9keSkpO1xuXHR9IGVsc2Uge1xuXHRcdHRoaXMubmF2aWdhdGUoe1xuXHRcdFx0dXJsOiB1cmwsXG5cdFx0XHRtZXRob2Q6IG1ldGhvZCxcblx0XHRcdGJvZHk6IHNlcmlhbGl6ZWQuYm9keSxcblx0XHRcdGZpbGVzOiBzZXJpYWxpemVkLmZpbGVzXG5cdFx0fSlcblx0fVxuXG5cdGlmICghZWwuaGFzQXR0cmlidXRlKFwiZGF0YS1ub3Jlc2V0XCIpKSBlbC5yZXNldCgpO1xuXHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xufTtcblxuLypcbiAqIEhhbmRsZSBpbnRlcmNlcHRpbmcgbGluayBjbGlja3MgdG8gdXBkYXRlIHRoZSB1cmwuXG4gKlxuICogQHBhcmFtIHtPYmplY3R9IGV2ZW50XG4gKi9cbmZ1bmN0aW9uIG9uQ2xpY2sgKGUpIHtcblx0Ly8gSWdub3JlIGNhbmNlbGVkIGV2ZW50cywgbW9kaWZpZWQgY2xpY2tzLCBhbmQgcmlnaHQgY2xpY2tzLlxuXHRpZiAoZXZlbnQuZGVmYXVsdFByZXZlbnRlZCB8fFxuXHRcdGV2ZW50Lm1ldGFLZXkgfHxcblx0XHRldmVudC5jdHJsS2V5IHx8XG5cdFx0ZXZlbnQuc2hpZnRLZXkgfHxcblx0XHRldmVudC5idXR0b24gIT09IDApIHJldHVybjtcblxuXHQvLyBHZXQgdGhlIDxmb3JtPiBlbGVtZW50LlxuXHR2YXIgZWwgPSBldmVudC50YXJnZXQ7XG5cdHdoaWxlIChlbCAhPSBudWxsICYmIGVsLm5vZGVOYW1lICE9PSBcIkFcIikgZWwgPSBlbC5wYXJlbnROb2RlO1xuXG5cdC8vIElnbm9yZSBpZiB3ZSBjb3VsZG4ndCBmaW5kIGEgbGluay5cblx0aWYgKCFlbCkgcmV0dXJuO1xuXG5cdC8vIElnbm9yZSBjbGlja3MgZnJvbSBsaW5rbGVzcyBlbGVtZW50c1xuXHRpZiAoIWVsLmhyZWYpIHJldHVybjtcblxuXHR2YXIgdXJsID0gZWwuaHJlZjtcblx0Ly8gSWdub3JlIGRvd25sb2FkYWJsZSBsaW5rcy5cblx0aWYgKGVsLmRvd25sb2FkKSByZXR1cm47XG5cdC8vIElnbm9yZSB0aGUgY2xpY2sgaWYgdGhlIGVsZW1lbnQgaGFzIGEgdGFyZ2V0LlxuXHRpZiAoZWwudGFyZ2V0ICYmIGVsLnRhcmdldCAhPT0gXCJfc2VsZlwiKSByZXR1cm47XG5cdC8vIElnbm9yZSAncmVsPVwiZXh0ZXJuYWxcIicgbGlua3MuXG5cdGlmIChlbC5yZWwgJiYgcmVnLnJlbC50ZXN0KGVsLnJlbCkpIHJldHVybjtcblxuXHQvLyBVc2UgYSB1cmwgcGFyc2VyIHRvIHBhcnNlIFVSTHMgaW5zdGVhZCBvZiByZWx5aW5nIG9uIHRoZSBicm93c2VyXG5cdC8vIHRvIGRvIGl0IGZvciB1cyAoYmVjYXVzZSBJRSkuXG5cdHZhciBwYXJzZWQgPSBwYXJzZVVSTCh1cmwpO1xuXHQvLyBJZ25vcmUgbGlua3MgdGhhdCBkb24ndCBzaGFyZSBhIHByb3RvY29sIHdpdGggdGhlIGJyb3dzZXJzLlxuXHRpZiAobG9jYXRpb24ucHJvdG9jb2wuaW5kZXhPZihwYXJzZWQucHJvdG9jb2wpID09PSAtMSkgcmV0dXJuO1xuXHQvLyBJZ25vcmUgbGlua3MgdGhhdCBkb24ndCBzaGFyZSBhIGhvc3Qgd2l0aCB0aGUgYnJvd3NlcnMuXG5cdGlmIChsb2NhdGlvbi5ob3N0ICE9PSBwYXJzZWQuaG9zdCkgcmV0dXJuO1xuXG5cdHRoaXMubmF2aWdhdGUodXJsKTtcblx0ZXZlbnQucHJldmVudERlZmF1bHQoKTtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gU2VydmVyOyIsIi8qKiBSaWxsKGZvcm0tanNvbikgdjAuMS4wICovXG52YXIgbWF0Y2hBcnJheSwgc2V0dGVyLCB1cmxlbmNvZGVkO1xuXG51cmxlbmNvZGVkID0gXCJhcHBsaWNhdGlvbi94LXd3dy1mb3JtLXVybGVuY29kZWRcIjtcblxubWF0Y2hBcnJheSA9IC9bXlxcW1xcXV0rfCg/PVxcW1xcXSkvZ2k7XG5cblxuLypcbiAqIFV0aWxpdHkgdG8gY3JlYXRlIGEgc2V0dGVyIGZvciBhIHBhcnNlZCBmb3JtIGJvZHkuXG4gKiBUaGUgc2V0dGVyIHdpbGwgY3JlYXRlIGFycmF5cyBmb3IgdmFsdWVzIGxpa2UgXCJhW11cIiBpZiB0aGUgZW5jdHlwZSBpcyB1cmxlbmNvZGVkLlxuI1xuICogQHBhcmFtIHtPYmplY3R9IG9ialxuICogQHBhcmFtIHtCb29sZWFufSBlbmNvZGVkXG4gKiBAcGFyYW0geyp9IGZ1bmN0aW9uXG4gKi9cblxuc2V0dGVyID0gZnVuY3Rpb24ob2JqLCBlbmN0eXBlKSB7XG4gIHJldHVybiBmdW5jdGlvbihwYXRoLCB2YWwpIHtcbiAgICB2YXIgY3VyLCBrZXksIGtleXMsIHByZXY7XG4gICAgaWYgKGVuY3R5cGUgIT09IHVybGVuY29kZWQpIHtcbiAgICAgIHJldHVybiBvYmpbcGF0aF0gPSB2YWw7XG4gICAgfVxuICAgIGtleXMgPSBwYXRoLm1hdGNoKG1hdGNoQXJyYXkpO1xuICAgIGN1ciA9IG9iajtcbiAgICB3aGlsZSAoa2V5cy5sZW5ndGgpIHtcbiAgICAgIHByZXYgPSBjdXI7XG4gICAgICBrZXkgPSBrZXlzLnNoaWZ0KCk7XG4gICAgICBpZiAoa2V5ID09PSBcIlwiKSB7XG4gICAgICAgIGtleSA9IGN1ci5sZW5ndGg7XG4gICAgICB9XG4gICAgICBjdXIgPSBjdXJba2V5XSAhPSBudWxsID8gY3VyW2tleV0gOiBjdXJba2V5XSA9IChrZXlzWzBdID09PSBcIlwiID8gW10gOiB7fSk7XG4gICAgfVxuICAgIHByZXZba2V5XSA9IHZhbDtcbiAgfTtcbn07XG5cblxuLypcbiAqIFNlcmlhbGl6ZSBhIGh0bWwgZm9ybSBhcyBKU09OLlxuI1xuICogQHBhcmFtIHs8Rm9ybS8+fSBmb3JtXG4gKiBAcmV0dXJucyB7IGJvZHksIGZpbGVzIH1cbiAqL1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKGZvcm0pIHtcbiAgdmFyIGJvZHksIGRpc2FibGVkLCBlbGVtZW50LCBmaWxlLCBmaWxlcywgaSwgaiwgbGVuLCBsZW4xLCBuYW1lLCBub2RlTmFtZSwgcmVmLCByZWYxLCByZWYyLCBzZWxlY3RlZCwgc2V0LCB2YWx1ZTtcbiAgaWYgKChmb3JtICE9IG51bGwgPyBmb3JtLm5vZGVOYW1lIDogdm9pZCAwKSAhPT0gXCJGT1JNXCIpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXCJDYW4gb25seSBwYXJzZSBmb3JtIGVsZW1lbnRzLlwiKTtcbiAgfVxuICBib2R5ID0ge307XG4gIGZpbGVzID0gW107XG4gIHNldCA9IHNldHRlcihib2R5LCBmb3JtLmVuY3R5cGUgfHwgdXJsZW5jb2RlZCk7XG4gIHJlZiA9IGZvcm0uZWxlbWVudHM7XG4gIGZvciAoaSA9IDAsIGxlbiA9IHJlZi5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgIGVsZW1lbnQgPSByZWZbaV07XG4gICAgbmFtZSA9IGVsZW1lbnQubmFtZSwgZGlzYWJsZWQgPSBlbGVtZW50LmRpc2FibGVkLCBub2RlTmFtZSA9IGVsZW1lbnQubm9kZU5hbWU7XG4gICAgaWYgKCFuYW1lIHx8IGRpc2FibGVkIHx8IChub2RlTmFtZSAhPT0gXCJJTlBVVFwiICYmIG5vZGVOYW1lICE9PSBcIlRFWFRBUkVBXCIgJiYgbm9kZU5hbWUgIT09IFwiU0VMRUNUXCIgJiYgbm9kZU5hbWUgIT09IFwiQlVUVE9OXCIpKSB7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG4gICAgc3dpdGNoIChlbGVtZW50LnR5cGUpIHtcbiAgICAgIGNhc2UgXCJzdWJtaXRcIjpcbiAgICAgICAgaWYgKGVsZW1lbnQgPT09IGRvY3VtZW50LmFjdGl2ZUVsZW1lbnQpIHtcbiAgICAgICAgICBzZXQobmFtZSwgZWxlbWVudC52YWx1ZSk7XG4gICAgICAgIH1cbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIFwiY2hlY2tib3hcIjpcbiAgICAgIGNhc2UgXCJyYWRpb1wiOlxuICAgICAgICBpZiAoZWxlbWVudC5jaGVja2VkKSB7XG4gICAgICAgICAgc2V0KG5hbWUsIGVsZW1lbnQudmFsdWUpO1xuICAgICAgICB9XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBcInNlbGVjdC1vbmVcIjpcbiAgICAgICAgc2V0KG5hbWUsIChyZWYxID0gZWxlbWVudC5vcHRpb25zW2VsZW1lbnQuc2VsZWN0ZWRJbmRleF0pICE9IG51bGwgPyByZWYxLnZhbHVlIDogdm9pZCAwKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIFwic2VsZWN0LW11bHRpcGxlXCI6XG4gICAgICAgIHNldChuYW1lLCAoZnVuY3Rpb24oKSB7XG4gICAgICAgICAgdmFyIGosIGxlbjEsIHJlZjIsIHJlZjMsIHJlc3VsdHM7XG4gICAgICAgICAgcmVmMiA9IGVsZW1lbnQub3B0aW9ucztcbiAgICAgICAgICByZXN1bHRzID0gW107XG4gICAgICAgICAgZm9yIChqID0gMCwgbGVuMSA9IHJlZjIubGVuZ3RoOyBqIDwgbGVuMTsgaisrKSB7XG4gICAgICAgICAgICByZWYzID0gcmVmMltqXSwgdmFsdWUgPSByZWYzLnZhbHVlLCBzZWxlY3RlZCA9IHJlZjMuc2VsZWN0ZWQ7XG4gICAgICAgICAgICBpZiAoc2VsZWN0ZWQpIHtcbiAgICAgICAgICAgICAgcmVzdWx0cy5wdXNoKHZhbHVlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgcmV0dXJuIHJlc3VsdHM7XG4gICAgICAgIH0pKCkpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgXCJmaWxlXCI6XG4gICAgICAgIGlmIChlbGVtZW50LmZpbGVzKSB7XG4gICAgICAgICAgcmVmMiA9IGVsZW1lbnQuZmlsZXM7XG4gICAgICAgICAgZm9yIChqID0gMCwgbGVuMSA9IHJlZjIubGVuZ3RoOyBqIDwgbGVuMTsgaisrKSB7XG4gICAgICAgICAgICBmaWxlID0gcmVmMltqXTtcbiAgICAgICAgICAgIGZpbGUuZmllbGQgPSBuYW1lO1xuICAgICAgICAgICAgZmlsZXMucHVzaChmaWxlKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgYnJlYWs7XG4gICAgICBkZWZhdWx0OlxuICAgICAgICBzZXQobmFtZSwgZWxlbWVudC52YWx1ZSk7XG4gICAgfVxuICB9XG4gIHJldHVybiB7XG4gICAgYm9keTogYm9keSxcbiAgICBmaWxlczogZmlsZXNcbiAgfTtcbn07XG4iLCIvKiogUmlsbChwYXJzZS11cmwpIHYwLjMuMSAqL1xuXCJ1c2Ugc3RyaWN0XCI7XG52YXIgZGF0ZVJlZywgaHR0cFJlZywgcGFyc2VEYXRlcywgdXJsbGl0ZTtcblxudXJsbGl0ZSA9IHJlcXVpcmUoXCJ1cmxsaXRlXCIpO1xuXG5odHRwUmVnID0gL15odHRwcz86XFwvXFwvL2k7XG5cbmRhdGVSZWcgPSAvXihcXGR7NH0pLShcXGR7Mn0pLShcXGR7Mn0pVChcXGR7Mn0pOihcXGR7Mn0pOihcXGR7Mn0oPzpcXC5cXGQqKSkoPzpafChcXCt8LSkoW1xcZHw6XSopKT8kLztcblxuXG4vKlxuICogV2hlbiB1c2VkIGFzIGEgdHJhbnNmb3JtIGZvciBKU09OLnBhcnNlIGRhdGUgc3RyaW5ncyB3aWxsIGJlIHR1cm5lZCBpbnRvIGRhdGUgb2JqZWN0cy5cbiNcbiAqIEBwYXJhbSB7U3RyaW5nfSBrZXlcbiAqIEBwYXJhbSB7U3RyaW5nfSB2YWxcbiAqL1xuXG5wYXJzZURhdGVzID0gZnVuY3Rpb24oa2V5LCB2YWwpIHtcbiAgaWYgKFwic3RyaW5nXCIgPT09IHR5cGVvZiB2YWwgJiYgZGF0ZVJlZy50ZXN0KHZhbCkpIHtcbiAgICByZXR1cm4gbmV3IERhdGUodmFsKTtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gdmFsO1xuICB9XG59O1xuXG5cbi8qXG4gKiBFeHRyYWN0IGEgcGFyc2VkIHVybCBmcm9tIGEgcmVxdWVzdCBvYmplY3QuXG4jXG4gKiBAcGFyYW0ge1JlcXVlc3R9IHJlcVxuICovXG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24odXJsLCByZXEpIHtcbiAgdmFyIGRlZmF1bHRzLCBlcnIsIGhvc3RuYW1lLCBwYXJzZWQsIHBvcnQsIHByb3RvY29sLCByZWYsIHJlZjE7XG4gIGlmICh1cmwgPT0gbnVsbCkge1xuICAgIHVybCA9IFwiL1wiO1xuICB9XG4gIGRlZmF1bHRzID0gKHJlcSBpbnN0YW5jZW9mIE5vZGUgPyByZXEgOiBsb2NhdGlvbik7XG4gIHByb3RvY29sID0gKGRlZmF1bHRzLnByb3RvY29sID8gKFwiOlwiID09PSBkZWZhdWx0cy5wcm90b2NvbC5zbGljZSgtMSkgPyBkZWZhdWx0cy5wcm90b2NvbC5zbGljZSgwLCAtMSkgOiBkZWZhdWx0cy5wcm90b2NvbCkgOiBcImh0dHBcIik7XG4gIHBvcnQgPSAoZGVmYXVsdHMucG9ydCA/IFwiOlwiICsgZGVmYXVsdHMucG9ydCA6IFwiXCIpO1xuICB1cmwgPSAoaHR0cFJlZy50ZXN0KHVybCkgPyB1cmwgOiBwcm90b2NvbCArIFwiOi8vXCIgKyBkZWZhdWx0cy5ob3N0bmFtZSArIHBvcnQgKyB1cmwpO1xuICBwYXJzZWQgPSB1cmxsaXRlKHVybCk7XG4gIHBhcnNlZC5zZWFyY2ggPSBkZWNvZGVVUklDb21wb25lbnQocGFyc2VkLnNlYXJjaCk7XG4gIHBhcnNlZC5zZWFyY2ggPSBwYXJzZWQuc2VhcmNoLnNsaWNlKDEsICtwYXJzZWQuc2VhcmNoLmxhc3RJbmRleE9mKFwifVwiKSArIDEgfHwgOWU5KTtcbiAgdHJ5IHtcbiAgICBwYXJzZWQucXVlcnkgPSBKU09OLnBhcnNlKHBhcnNlZC5zZWFyY2gsIHBhcnNlRGF0ZXMpO1xuICB9IGNhdGNoIChfZXJyb3IpIHtcbiAgICBlcnIgPSBfZXJyb3I7XG4gICAgcGFyc2VkLnF1ZXJ5ID0ge307XG4gIH1cbiAgcmV0dXJuIHtcbiAgICB1cmw6IHVybCxcbiAgICBvcmlnaW46IHBhcnNlZC5vcmlnaW4sXG4gICAgcHJvdG9jb2w6IHBhcnNlZC5wcm90b2NvbC5zbGljZSgwLCAtMSksXG4gICAgaG9zdDogcGFyc2VkLmhvc3QsXG4gICAgaG9zdG5hbWU6IHBhcnNlZC5ob3N0bmFtZSxcbiAgICBwb3J0OiBwYXJzZWQucG9ydCxcbiAgICBwYXRoOiBwYXJzZWQucGF0aG5hbWUsXG4gICAgc2VhcmNoOiBwYXJzZWQuc2VhcmNoLFxuICAgIHF1ZXJ5OiBwYXJzZWQucXVlcnksXG4gICAgaGFzaDogcGFyc2VkLmhhc2guc2xpY2UoMSlcbiAgfTtcbn07XG4iLCIoZnVuY3Rpb24oKSB7XG4gIHZhciB1cmxsaXRlO1xuXG4gIHVybGxpdGUgPSByZXF1aXJlKCcuL2NvcmUnKTtcblxuICByZXF1aXJlKCcuL2V4dGVuc2lvbnMvcmVzb2x2ZScpO1xuXG4gIHJlcXVpcmUoJy4vZXh0ZW5zaW9ucy9yZWxhdGl2aXplJyk7XG5cbiAgcmVxdWlyZSgnLi9leHRlbnNpb25zL25vcm1hbGl6ZScpO1xuXG4gIHJlcXVpcmUoJy4vZXh0ZW5zaW9ucy90b1N0cmluZycpO1xuXG4gIG1vZHVsZS5leHBvcnRzID0gdXJsbGl0ZTtcblxufSkuY2FsbCh0aGlzKTtcbiIsIihmdW5jdGlvbigpIHtcbiAgdmFyIFVSTCwgVVJMX1BBVFRFUk4sIGRlZmF1bHRzLCB1cmxsaXRlLFxuICAgIF9faGFzUHJvcCA9IHt9Lmhhc093blByb3BlcnR5O1xuXG4gIFVSTF9QQVRURVJOID0gL14oPzooPzooW146XFwvP1xcI10rOilcXC8rfChcXC9cXC8pKSg/OihbYS16MC05LVxcLl9+JV0rKSg/OjooW2EtejAtOS1cXC5ffiVdKykpP0ApPygoW2EtejAtOS1cXC5ffiUhJCYnKCkqKyw7PV0rKSg/OjooWzAtOV0rKSk/KT8pPyhbXj9cXCNdKj8pKFxcP1teXFwjXSopPyhcXCMuKik/JC87XG5cbiAgdXJsbGl0ZSA9IGZ1bmN0aW9uKHJhdywgb3B0cykge1xuICAgIHJldHVybiB1cmxsaXRlLlVSTC5wYXJzZShyYXcsIG9wdHMpO1xuICB9O1xuXG4gIHVybGxpdGUuVVJMID0gVVJMID0gKGZ1bmN0aW9uKCkge1xuICAgIGZ1bmN0aW9uIFVSTChwcm9wcykge1xuICAgICAgdmFyIGssIHYsIF9yZWY7XG4gICAgICBmb3IgKGsgaW4gZGVmYXVsdHMpIHtcbiAgICAgICAgaWYgKCFfX2hhc1Byb3AuY2FsbChkZWZhdWx0cywgaykpIGNvbnRpbnVlO1xuICAgICAgICB2ID0gZGVmYXVsdHNba107XG4gICAgICAgIHRoaXNba10gPSAoX3JlZiA9IHByb3BzW2tdKSAhPSBudWxsID8gX3JlZiA6IHY7XG4gICAgICB9XG4gICAgICB0aGlzLmhvc3QgfHwgKHRoaXMuaG9zdCA9IHRoaXMuaG9zdG5hbWUgJiYgdGhpcy5wb3J0ID8gXCJcIiArIHRoaXMuaG9zdG5hbWUgKyBcIjpcIiArIHRoaXMucG9ydCA6IHRoaXMuaG9zdG5hbWUgPyB0aGlzLmhvc3RuYW1lIDogJycpO1xuICAgICAgdGhpcy5vcmlnaW4gfHwgKHRoaXMub3JpZ2luID0gdGhpcy5wcm90b2NvbCA/IFwiXCIgKyB0aGlzLnByb3RvY29sICsgXCIvL1wiICsgdGhpcy5ob3N0IDogJycpO1xuICAgICAgdGhpcy5pc0Fic29sdXRlUGF0aFJlbGF0aXZlID0gIXRoaXMuaG9zdCAmJiB0aGlzLnBhdGhuYW1lLmNoYXJBdCgwKSA9PT0gJy8nO1xuICAgICAgdGhpcy5pc1BhdGhSZWxhdGl2ZSA9ICF0aGlzLmhvc3QgJiYgdGhpcy5wYXRobmFtZS5jaGFyQXQoMCkgIT09ICcvJztcbiAgICAgIHRoaXMuaXNSZWxhdGl2ZSA9IHRoaXMuaXNTY2hlbWVSZWxhdGl2ZSB8fCB0aGlzLmlzQWJzb2x1dGVQYXRoUmVsYXRpdmUgfHwgdGhpcy5pc1BhdGhSZWxhdGl2ZTtcbiAgICAgIHRoaXMuaXNBYnNvbHV0ZSA9ICF0aGlzLmlzUmVsYXRpdmU7XG4gICAgfVxuXG4gICAgVVJMLnBhcnNlID0gZnVuY3Rpb24ocmF3KSB7XG4gICAgICB2YXIgbSwgcGF0aG5hbWUsIHByb3RvY29sO1xuICAgICAgbSA9IHJhdy50b1N0cmluZygpLm1hdGNoKFVSTF9QQVRURVJOKTtcbiAgICAgIHBhdGhuYW1lID0gbVs4XSB8fCAnJztcbiAgICAgIHByb3RvY29sID0gbVsxXTtcbiAgICAgIHJldHVybiBuZXcgdXJsbGl0ZS5VUkwoe1xuICAgICAgICBwcm90b2NvbDogcHJvdG9jb2wsXG4gICAgICAgIHVzZXJuYW1lOiBtWzNdLFxuICAgICAgICBwYXNzd29yZDogbVs0XSxcbiAgICAgICAgaG9zdG5hbWU6IG1bNl0sXG4gICAgICAgIHBvcnQ6IG1bN10sXG4gICAgICAgIHBhdGhuYW1lOiBwcm90b2NvbCAmJiBwYXRobmFtZS5jaGFyQXQoMCkgIT09ICcvJyA/IFwiL1wiICsgcGF0aG5hbWUgOiBwYXRobmFtZSxcbiAgICAgICAgc2VhcmNoOiBtWzldLFxuICAgICAgICBoYXNoOiBtWzEwXSxcbiAgICAgICAgaXNTY2hlbWVSZWxhdGl2ZTogbVsyXSAhPSBudWxsXG4gICAgICB9KTtcbiAgICB9O1xuXG4gICAgcmV0dXJuIFVSTDtcblxuICB9KSgpO1xuXG4gIGRlZmF1bHRzID0ge1xuICAgIHByb3RvY29sOiAnJyxcbiAgICB1c2VybmFtZTogJycsXG4gICAgcGFzc3dvcmQ6ICcnLFxuICAgIGhvc3Q6ICcnLFxuICAgIGhvc3RuYW1lOiAnJyxcbiAgICBwb3J0OiAnJyxcbiAgICBwYXRobmFtZTogJycsXG4gICAgc2VhcmNoOiAnJyxcbiAgICBoYXNoOiAnJyxcbiAgICBvcmlnaW46ICcnLFxuICAgIGlzU2NoZW1lUmVsYXRpdmU6IGZhbHNlXG4gIH07XG5cbiAgbW9kdWxlLmV4cG9ydHMgPSB1cmxsaXRlO1xuXG59KS5jYWxsKHRoaXMpO1xuIiwiKGZ1bmN0aW9uKCkge1xuICB2YXIgVVJMLCBleHRlbmQsIHVybGxpdGU7XG5cbiAgdXJsbGl0ZSA9IHJlcXVpcmUoJy4uL2NvcmUnKTtcblxuICBVUkwgPSB1cmxsaXRlLlVSTDtcblxuICBleHRlbmQgPSByZXF1aXJlKCd4dGVuZCcpO1xuXG4gIFVSTC5wcm90b3R5cGUubm9ybWFsaXplID0gZnVuY3Rpb24oKSB7XG4gICAgdmFyIG0sIHBhdGhuYW1lO1xuICAgIHBhdGhuYW1lID0gdGhpcy5wYXRobmFtZTtcbiAgICB3aGlsZSAobSA9IC9eKC4qPylbXlxcL10rXFwvXFwuXFwuXFwvKiguKikkLy5leGVjKHBhdGhuYW1lKSkge1xuICAgICAgcGF0aG5hbWUgPSBcIlwiICsgbVsxXSArIG1bMl07XG4gICAgfVxuICAgIGlmICh0aGlzLmhvc3QgJiYgcGF0aG5hbWUuaW5kZXhPZignLi4nKSAhPT0gLTEpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignUGF0aCBpcyBiZWhpbmQgcm9vdC4nKTtcbiAgICB9XG4gICAgcmV0dXJuIG5ldyB1cmxsaXRlLlVSTChleHRlbmQodGhpcywge1xuICAgICAgcGF0aG5hbWU6IHBhdGhuYW1lXG4gICAgfSkpO1xuICB9O1xuXG59KS5jYWxsKHRoaXMpO1xuIiwiKGZ1bmN0aW9uKCkge1xuICB2YXIgVVJMLCB1cmxsaXRlO1xuXG4gIHVybGxpdGUgPSByZXF1aXJlKCcuLi9jb3JlJyk7XG5cbiAgcmVxdWlyZSgnLi9yZXNvbHZlJyk7XG5cbiAgVVJMID0gdXJsbGl0ZS5VUkw7XG5cbiAgVVJMLnByb3RvdHlwZS5yZWxhdGl2aXplID0gZnVuY3Rpb24ob3RoZXIpIHtcbiAgICB2YXIgYywgaSwgbmV3U2VnbWVudHMsIG90aGVyU2VnbWVudHMsIHVybCwgdXJsU2VnbWVudHMsIF9pLCBfbGVuLCBfcmVmO1xuICAgIGlmICh0aGlzLmlzUGF0aFJlbGF0aXZlKSB7XG4gICAgICByZXR1cm4gbmV3IHVybGxpdGUuVVJMKHRoaXMpO1xuICAgIH1cbiAgICBpZiAodHlwZW9mIG90aGVyID09PSAnc3RyaW5nJykge1xuICAgICAgb3RoZXIgPSB1cmxsaXRlKG90aGVyKTtcbiAgICB9XG4gICAgdXJsID0gdGhpcy5yZXNvbHZlKG90aGVyKTtcbiAgICBpZiAodXJsLm9yaWdpbiAmJiB1cmwub3JpZ2luICE9PSBvdGhlci5vcmlnaW4pIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcIk9yaWdpbnMgZG9uJ3QgbWF0Y2ggKFwiICsgdXJsLm9yaWdpbiArIFwiIGFuZCBcIiArIG90aGVyLm9yaWdpbiArIFwiKVwiKTtcbiAgICB9IGVsc2UgaWYgKCFvdGhlci5pc0Fic29sdXRlICYmICFvdGhlci5pc0Fic29sdXRlUGF0aFJlbGF0aXZlKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJPdGhlciBVUkwgKDxcIiArIG90aGVyICsgXCI+KSBpcyBuZWl0aGVyIGFic29sdXRlIG5vciBhYnNvbHV0ZSBwYXRoIHJlbGF0aXZlLlwiKTtcbiAgICB9XG4gICAgb3RoZXJTZWdtZW50cyA9IG90aGVyLnBhdGhuYW1lLnNwbGl0KCcvJykuc2xpY2UoMSk7XG4gICAgdXJsU2VnbWVudHMgPSB1cmwucGF0aG5hbWUuc3BsaXQoJy8nKS5zbGljZSgxKTtcbiAgICBmb3IgKGkgPSBfaSA9IDAsIF9sZW4gPSB1cmxTZWdtZW50cy5sZW5ndGg7IF9pIDwgX2xlbjsgaSA9ICsrX2kpIHtcbiAgICAgIGMgPSB1cmxTZWdtZW50c1tpXTtcbiAgICAgIGlmICghKGMgPT09IG90aGVyU2VnbWVudHNbaV0gJiYgKHVybFNlZ21lbnRzLmxlbmd0aCA+IChfcmVmID0gaSArIDEpICYmIF9yZWYgPCBvdGhlclNlZ21lbnRzLmxlbmd0aCkpKSB7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cbiAgICBuZXdTZWdtZW50cyA9IHVybFNlZ21lbnRzLnNsaWNlKGkpO1xuICAgIHdoaWxlIChpIDwgb3RoZXJTZWdtZW50cy5sZW5ndGggLSAxKSB7XG4gICAgICBpZiAob3RoZXJTZWdtZW50c1tpXSkge1xuICAgICAgICBuZXdTZWdtZW50cy51bnNoaWZ0KCcuLicpO1xuICAgICAgfVxuICAgICAgaSsrO1xuICAgIH1cbiAgICBpZiAobmV3U2VnbWVudHMubGVuZ3RoID09PSAxKSB7XG4gICAgICBuZXdTZWdtZW50cyA9IG5ld1NlZ21lbnRzWzBdID09PSBvdGhlclNlZ21lbnRzW2ldID8gWycnXSA6IG5ld1NlZ21lbnRzWzBdID09PSAnJyA/IFsnLiddIDogbmV3U2VnbWVudHM7XG4gICAgfVxuICAgIHJldHVybiBuZXcgdXJsbGl0ZS5VUkwoe1xuICAgICAgcGF0aG5hbWU6IG5ld1NlZ21lbnRzLmpvaW4oJy8nKSxcbiAgICAgIHNlYXJjaDogdXJsLnNlYXJjaCxcbiAgICAgIGhhc2g6IHVybC5oYXNoXG4gICAgfSk7XG4gIH07XG5cbn0pLmNhbGwodGhpcyk7XG4iLCIoZnVuY3Rpb24oKSB7XG4gIHZhciBVUkwsIGNvcHlQcm9wcywgb2xkUGFyc2UsIHVybGxpdGUsXG4gICAgX19zbGljZSA9IFtdLnNsaWNlO1xuXG4gIHVybGxpdGUgPSByZXF1aXJlKCcuLi9jb3JlJyk7XG5cbiAgcmVxdWlyZSgnLi9ub3JtYWxpemUnKTtcblxuICBVUkwgPSB1cmxsaXRlLlVSTDtcblxuICBvbGRQYXJzZSA9IFVSTC5wYXJzZTtcblxuICBjb3B5UHJvcHMgPSBmdW5jdGlvbigpIHtcbiAgICB2YXIgcHJvcCwgcHJvcHMsIHNvdXJjZSwgdGFyZ2V0LCBfaSwgX2xlbjtcbiAgICB0YXJnZXQgPSBhcmd1bWVudHNbMF0sIHNvdXJjZSA9IGFyZ3VtZW50c1sxXSwgcHJvcHMgPSAzIDw9IGFyZ3VtZW50cy5sZW5ndGggPyBfX3NsaWNlLmNhbGwoYXJndW1lbnRzLCAyKSA6IFtdO1xuICAgIGZvciAoX2kgPSAwLCBfbGVuID0gcHJvcHMubGVuZ3RoOyBfaSA8IF9sZW47IF9pKyspIHtcbiAgICAgIHByb3AgPSBwcm9wc1tfaV07XG4gICAgICB0YXJnZXRbcHJvcF0gPSBzb3VyY2VbcHJvcF07XG4gICAgfVxuICAgIHJldHVybiB0YXJnZXQ7XG4gIH07XG5cbiAgVVJMLnBhcnNlID0gZnVuY3Rpb24ocmF3LCBvcHRzKSB7XG4gICAgdmFyIGJhc2UsIHVybDtcbiAgICBpZiAoYmFzZSA9IG9wdHMgIT0gbnVsbCA/IG9wdHMuYmFzZSA6IHZvaWQgMCkge1xuICAgICAgZGVsZXRlIG9wdHMuYmFzZTtcbiAgICB9XG4gICAgdXJsID0gb2xkUGFyc2UocmF3LCBvcHRzKTtcbiAgICBpZiAoYmFzZSkge1xuICAgICAgcmV0dXJuIHVybC5yZXNvbHZlKGJhc2UpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gdXJsO1xuICAgIH1cbiAgfTtcblxuICBVUkwucHJvdG90eXBlLnJlc29sdmUgPSBmdW5jdGlvbihiYXNlKSB7XG4gICAgdmFyIHAsIHByZWZpeDtcbiAgICBpZiAodGhpcy5pc0Fic29sdXRlKSB7XG4gICAgICByZXR1cm4gbmV3IHVybGxpdGUuVVJMKHRoaXMpO1xuICAgIH1cbiAgICBpZiAodHlwZW9mIGJhc2UgPT09ICdzdHJpbmcnKSB7XG4gICAgICBiYXNlID0gdXJsbGl0ZShiYXNlKTtcbiAgICB9XG4gICAgcCA9IHt9O1xuICAgIGlmICh0aGlzLmlzU2NoZW1lUmVsYXRpdmUpIHtcbiAgICAgIGNvcHlQcm9wcyhwLCB0aGlzLCAndXNlcm5hbWUnLCAncGFzc3dvcmQnLCAnaG9zdCcsICdob3N0bmFtZScsICdwb3J0JywgJ3BhdGhuYW1lJywgJ3NlYXJjaCcsICdoYXNoJyk7XG4gICAgICBwLmlzU2NoZW1lUmVsYXRpdmUgPSAhKHAucHJvdG9jb2wgPSBiYXNlLnByb3RvY29sKTtcbiAgICB9IGVsc2UgaWYgKHRoaXMuaXNBYnNvbHV0ZVBhdGhSZWxhdGl2ZSB8fCB0aGlzLmlzUGF0aFJlbGF0aXZlKSB7XG4gICAgICBjb3B5UHJvcHMocCwgdGhpcywgJ3NlYXJjaCcsICdoYXNoJyk7XG4gICAgICBjb3B5UHJvcHMocCwgYmFzZSwgJ3Byb3RvY29sJywgJ3VzZXJuYW1lJywgJ3Bhc3N3b3JkJywgJ2hvc3QnLCAnaG9zdG5hbWUnLCAncG9ydCcpO1xuICAgICAgcC5wYXRobmFtZSA9IHRoaXMuaXNQYXRoUmVsYXRpdmUgPyBiYXNlLnBhdGhuYW1lLnNsaWNlKDAsIC0xKSA9PT0gJy8nID8gXCJcIiArIGJhc2UucGF0aG5hbWUgKyBcIi9cIiArIHRoaXMucGF0aG5hbWUgOiAocHJlZml4ID0gYmFzZS5wYXRobmFtZS5zcGxpdCgnLycpLnNsaWNlKDAsIC0xKS5qb2luKCcvJyksIHByZWZpeCA/IFwiXCIgKyBwcmVmaXggKyBcIi9cIiArIHRoaXMucGF0aG5hbWUgOiB0aGlzLnBhdGhuYW1lKSA6IHRoaXMucGF0aG5hbWU7XG4gICAgfVxuICAgIHJldHVybiBuZXcgdXJsbGl0ZS5VUkwocCkubm9ybWFsaXplKCk7XG4gIH07XG5cbn0pLmNhbGwodGhpcyk7XG4iLCIoZnVuY3Rpb24oKSB7XG4gIHZhciBVUkwsIHVybGxpdGU7XG5cbiAgdXJsbGl0ZSA9IHJlcXVpcmUoJy4uL2NvcmUnKTtcblxuICBVUkwgPSB1cmxsaXRlLlVSTDtcblxuICBVUkwucHJvdG90eXBlLnRvU3RyaW5nID0gZnVuY3Rpb24oKSB7XG4gICAgdmFyIGF1dGhvcml0eSwgcHJlZml4LCB1c2VyaW5mbztcbiAgICBwcmVmaXggPSB0aGlzLmlzU2NoZW1lUmVsYXRpdmUgPyAnLy8nIDogdGhpcy5wcm90b2NvbCA9PT0gJ2ZpbGU6JyA/IFwiXCIgKyB0aGlzLnByb3RvY29sICsgXCIvLy9cIiA6IHRoaXMucHJvdG9jb2wgPyBcIlwiICsgdGhpcy5wcm90b2NvbCArIFwiLy9cIiA6ICcnO1xuICAgIHVzZXJpbmZvID0gdGhpcy5wYXNzd29yZCA/IFwiXCIgKyB0aGlzLnVzZXJuYW1lICsgXCI6XCIgKyB0aGlzLnBhc3N3b3JkIDogdGhpcy51c2VybmFtZSA/IFwiXCIgKyB0aGlzLnVzZXJuYW1lIDogJyc7XG4gICAgYXV0aG9yaXR5ID0gdXNlcmluZm8gPyBcIlwiICsgdXNlcmluZm8gKyBcIkBcIiArIHRoaXMuaG9zdCA6IHRoaXMuaG9zdCA/IFwiXCIgKyB0aGlzLmhvc3QgOiAnJztcbiAgICByZXR1cm4gXCJcIiArIHByZWZpeCArIGF1dGhvcml0eSArIHRoaXMucGF0aG5hbWUgKyB0aGlzLnNlYXJjaCArIHRoaXMuaGFzaDtcbiAgfTtcblxufSkuY2FsbCh0aGlzKTtcbiIsIm1vZHVsZS5leHBvcnRzID0gZXh0ZW5kXG5cbmZ1bmN0aW9uIGV4dGVuZCgpIHtcbiAgICB2YXIgdGFyZ2V0ID0ge31cblxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgYXJndW1lbnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHZhciBzb3VyY2UgPSBhcmd1bWVudHNbaV1cblxuICAgICAgICBmb3IgKHZhciBrZXkgaW4gc291cmNlKSB7XG4gICAgICAgICAgICBpZiAoc291cmNlLmhhc093blByb3BlcnR5KGtleSkpIHtcbiAgICAgICAgICAgICAgICB0YXJnZXRba2V5XSA9IHNvdXJjZVtrZXldXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gdGFyZ2V0XG59XG4iLCIvLyBodHRwOi8vd2lraS5jb21tb25qcy5vcmcvd2lraS9Vbml0X1Rlc3RpbmcvMS4wXG4vL1xuLy8gVEhJUyBJUyBOT1QgVEVTVEVEIE5PUiBMSUtFTFkgVE8gV09SSyBPVVRTSURFIFY4IVxuLy9cbi8vIE9yaWdpbmFsbHkgZnJvbSBuYXJ3aGFsLmpzIChodHRwOi8vbmFyd2hhbGpzLm9yZylcbi8vIENvcHlyaWdodCAoYykgMjAwOSBUaG9tYXMgUm9iaW5zb24gPDI4MG5vcnRoLmNvbT5cbi8vXG4vLyBQZXJtaXNzaW9uIGlzIGhlcmVieSBncmFudGVkLCBmcmVlIG9mIGNoYXJnZSwgdG8gYW55IHBlcnNvbiBvYnRhaW5pbmcgYSBjb3B5XG4vLyBvZiB0aGlzIHNvZnR3YXJlIGFuZCBhc3NvY2lhdGVkIGRvY3VtZW50YXRpb24gZmlsZXMgKHRoZSAnU29mdHdhcmUnKSwgdG9cbi8vIGRlYWwgaW4gdGhlIFNvZnR3YXJlIHdpdGhvdXQgcmVzdHJpY3Rpb24sIGluY2x1ZGluZyB3aXRob3V0IGxpbWl0YXRpb24gdGhlXG4vLyByaWdodHMgdG8gdXNlLCBjb3B5LCBtb2RpZnksIG1lcmdlLCBwdWJsaXNoLCBkaXN0cmlidXRlLCBzdWJsaWNlbnNlLCBhbmQvb3Jcbi8vIHNlbGwgY29waWVzIG9mIHRoZSBTb2Z0d2FyZSwgYW5kIHRvIHBlcm1pdCBwZXJzb25zIHRvIHdob20gdGhlIFNvZnR3YXJlIGlzXG4vLyBmdXJuaXNoZWQgdG8gZG8gc28sIHN1YmplY3QgdG8gdGhlIGZvbGxvd2luZyBjb25kaXRpb25zOlxuLy9cbi8vIFRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlIGFuZCB0aGlzIHBlcm1pc3Npb24gbm90aWNlIHNoYWxsIGJlIGluY2x1ZGVkIGluXG4vLyBhbGwgY29waWVzIG9yIHN1YnN0YW50aWFsIHBvcnRpb25zIG9mIHRoZSBTb2Z0d2FyZS5cbi8vXG4vLyBUSEUgU09GVFdBUkUgSVMgUFJPVklERUQgJ0FTIElTJywgV0lUSE9VVCBXQVJSQU5UWSBPRiBBTlkgS0lORCwgRVhQUkVTUyBPUlxuLy8gSU1QTElFRCwgSU5DTFVESU5HIEJVVCBOT1QgTElNSVRFRCBUTyBUSEUgV0FSUkFOVElFUyBPRiBNRVJDSEFOVEFCSUxJVFksXG4vLyBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRSBBTkQgTk9OSU5GUklOR0VNRU5ULiBJTiBOTyBFVkVOVCBTSEFMTCBUSEVcbi8vIEFVVEhPUlMgQkUgTElBQkxFIEZPUiBBTlkgQ0xBSU0sIERBTUFHRVMgT1IgT1RIRVIgTElBQklMSVRZLCBXSEVUSEVSIElOIEFOXG4vLyBBQ1RJT04gT0YgQ09OVFJBQ1QsIFRPUlQgT1IgT1RIRVJXSVNFLCBBUklTSU5HIEZST00sIE9VVCBPRiBPUiBJTiBDT05ORUNUSU9OXG4vLyBXSVRIIFRIRSBTT0ZUV0FSRSBPUiBUSEUgVVNFIE9SIE9USEVSIERFQUxJTkdTIElOIFRIRSBTT0ZUV0FSRS5cblxuLy8gd2hlbiB1c2VkIGluIG5vZGUsIHRoaXMgd2lsbCBhY3R1YWxseSBsb2FkIHRoZSB1dGlsIG1vZHVsZSB3ZSBkZXBlbmQgb25cbi8vIHZlcnN1cyBsb2FkaW5nIHRoZSBidWlsdGluIHV0aWwgbW9kdWxlIGFzIGhhcHBlbnMgb3RoZXJ3aXNlXG4vLyB0aGlzIGlzIGEgYnVnIGluIG5vZGUgbW9kdWxlIGxvYWRpbmcgYXMgZmFyIGFzIEkgYW0gY29uY2VybmVkXG52YXIgdXRpbCA9IHJlcXVpcmUoJ3V0aWwvJyk7XG5cbnZhciBwU2xpY2UgPSBBcnJheS5wcm90b3R5cGUuc2xpY2U7XG52YXIgaGFzT3duID0gT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eTtcblxuLy8gMS4gVGhlIGFzc2VydCBtb2R1bGUgcHJvdmlkZXMgZnVuY3Rpb25zIHRoYXQgdGhyb3dcbi8vIEFzc2VydGlvbkVycm9yJ3Mgd2hlbiBwYXJ0aWN1bGFyIGNvbmRpdGlvbnMgYXJlIG5vdCBtZXQuIFRoZVxuLy8gYXNzZXJ0IG1vZHVsZSBtdXN0IGNvbmZvcm0gdG8gdGhlIGZvbGxvd2luZyBpbnRlcmZhY2UuXG5cbnZhciBhc3NlcnQgPSBtb2R1bGUuZXhwb3J0cyA9IG9rO1xuXG4vLyAyLiBUaGUgQXNzZXJ0aW9uRXJyb3IgaXMgZGVmaW5lZCBpbiBhc3NlcnQuXG4vLyBuZXcgYXNzZXJ0LkFzc2VydGlvbkVycm9yKHsgbWVzc2FnZTogbWVzc2FnZSxcbi8vICAgICAgICAgICAgICAgICAgICAgICAgICAgICBhY3R1YWw6IGFjdHVhbCxcbi8vICAgICAgICAgICAgICAgICAgICAgICAgICAgICBleHBlY3RlZDogZXhwZWN0ZWQgfSlcblxuYXNzZXJ0LkFzc2VydGlvbkVycm9yID0gZnVuY3Rpb24gQXNzZXJ0aW9uRXJyb3Iob3B0aW9ucykge1xuICB0aGlzLm5hbWUgPSAnQXNzZXJ0aW9uRXJyb3InO1xuICB0aGlzLmFjdHVhbCA9IG9wdGlvbnMuYWN0dWFsO1xuICB0aGlzLmV4cGVjdGVkID0gb3B0aW9ucy5leHBlY3RlZDtcbiAgdGhpcy5vcGVyYXRvciA9IG9wdGlvbnMub3BlcmF0b3I7XG4gIGlmIChvcHRpb25zLm1lc3NhZ2UpIHtcbiAgICB0aGlzLm1lc3NhZ2UgPSBvcHRpb25zLm1lc3NhZ2U7XG4gICAgdGhpcy5nZW5lcmF0ZWRNZXNzYWdlID0gZmFsc2U7XG4gIH0gZWxzZSB7XG4gICAgdGhpcy5tZXNzYWdlID0gZ2V0TWVzc2FnZSh0aGlzKTtcbiAgICB0aGlzLmdlbmVyYXRlZE1lc3NhZ2UgPSB0cnVlO1xuICB9XG4gIHZhciBzdGFja1N0YXJ0RnVuY3Rpb24gPSBvcHRpb25zLnN0YWNrU3RhcnRGdW5jdGlvbiB8fCBmYWlsO1xuXG4gIGlmIChFcnJvci5jYXB0dXJlU3RhY2tUcmFjZSkge1xuICAgIEVycm9yLmNhcHR1cmVTdGFja1RyYWNlKHRoaXMsIHN0YWNrU3RhcnRGdW5jdGlvbik7XG4gIH1cbiAgZWxzZSB7XG4gICAgLy8gbm9uIHY4IGJyb3dzZXJzIHNvIHdlIGNhbiBoYXZlIGEgc3RhY2t0cmFjZVxuICAgIHZhciBlcnIgPSBuZXcgRXJyb3IoKTtcbiAgICBpZiAoZXJyLnN0YWNrKSB7XG4gICAgICB2YXIgb3V0ID0gZXJyLnN0YWNrO1xuXG4gICAgICAvLyB0cnkgdG8gc3RyaXAgdXNlbGVzcyBmcmFtZXNcbiAgICAgIHZhciBmbl9uYW1lID0gc3RhY2tTdGFydEZ1bmN0aW9uLm5hbWU7XG4gICAgICB2YXIgaWR4ID0gb3V0LmluZGV4T2YoJ1xcbicgKyBmbl9uYW1lKTtcbiAgICAgIGlmIChpZHggPj0gMCkge1xuICAgICAgICAvLyBvbmNlIHdlIGhhdmUgbG9jYXRlZCB0aGUgZnVuY3Rpb24gZnJhbWVcbiAgICAgICAgLy8gd2UgbmVlZCB0byBzdHJpcCBvdXQgZXZlcnl0aGluZyBiZWZvcmUgaXQgKGFuZCBpdHMgbGluZSlcbiAgICAgICAgdmFyIG5leHRfbGluZSA9IG91dC5pbmRleE9mKCdcXG4nLCBpZHggKyAxKTtcbiAgICAgICAgb3V0ID0gb3V0LnN1YnN0cmluZyhuZXh0X2xpbmUgKyAxKTtcbiAgICAgIH1cblxuICAgICAgdGhpcy5zdGFjayA9IG91dDtcbiAgICB9XG4gIH1cbn07XG5cbi8vIGFzc2VydC5Bc3NlcnRpb25FcnJvciBpbnN0YW5jZW9mIEVycm9yXG51dGlsLmluaGVyaXRzKGFzc2VydC5Bc3NlcnRpb25FcnJvciwgRXJyb3IpO1xuXG5mdW5jdGlvbiByZXBsYWNlcihrZXksIHZhbHVlKSB7XG4gIGlmICh1dGlsLmlzVW5kZWZpbmVkKHZhbHVlKSkge1xuICAgIHJldHVybiAnJyArIHZhbHVlO1xuICB9XG4gIGlmICh1dGlsLmlzTnVtYmVyKHZhbHVlKSAmJiAhaXNGaW5pdGUodmFsdWUpKSB7XG4gICAgcmV0dXJuIHZhbHVlLnRvU3RyaW5nKCk7XG4gIH1cbiAgaWYgKHV0aWwuaXNGdW5jdGlvbih2YWx1ZSkgfHwgdXRpbC5pc1JlZ0V4cCh2YWx1ZSkpIHtcbiAgICByZXR1cm4gdmFsdWUudG9TdHJpbmcoKTtcbiAgfVxuICByZXR1cm4gdmFsdWU7XG59XG5cbmZ1bmN0aW9uIHRydW5jYXRlKHMsIG4pIHtcbiAgaWYgKHV0aWwuaXNTdHJpbmcocykpIHtcbiAgICByZXR1cm4gcy5sZW5ndGggPCBuID8gcyA6IHMuc2xpY2UoMCwgbik7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIHM7XG4gIH1cbn1cblxuZnVuY3Rpb24gZ2V0TWVzc2FnZShzZWxmKSB7XG4gIHJldHVybiB0cnVuY2F0ZShKU09OLnN0cmluZ2lmeShzZWxmLmFjdHVhbCwgcmVwbGFjZXIpLCAxMjgpICsgJyAnICtcbiAgICAgICAgIHNlbGYub3BlcmF0b3IgKyAnICcgK1xuICAgICAgICAgdHJ1bmNhdGUoSlNPTi5zdHJpbmdpZnkoc2VsZi5leHBlY3RlZCwgcmVwbGFjZXIpLCAxMjgpO1xufVxuXG4vLyBBdCBwcmVzZW50IG9ubHkgdGhlIHRocmVlIGtleXMgbWVudGlvbmVkIGFib3ZlIGFyZSB1c2VkIGFuZFxuLy8gdW5kZXJzdG9vZCBieSB0aGUgc3BlYy4gSW1wbGVtZW50YXRpb25zIG9yIHN1YiBtb2R1bGVzIGNhbiBwYXNzXG4vLyBvdGhlciBrZXlzIHRvIHRoZSBBc3NlcnRpb25FcnJvcidzIGNvbnN0cnVjdG9yIC0gdGhleSB3aWxsIGJlXG4vLyBpZ25vcmVkLlxuXG4vLyAzLiBBbGwgb2YgdGhlIGZvbGxvd2luZyBmdW5jdGlvbnMgbXVzdCB0aHJvdyBhbiBBc3NlcnRpb25FcnJvclxuLy8gd2hlbiBhIGNvcnJlc3BvbmRpbmcgY29uZGl0aW9uIGlzIG5vdCBtZXQsIHdpdGggYSBtZXNzYWdlIHRoYXRcbi8vIG1heSBiZSB1bmRlZmluZWQgaWYgbm90IHByb3ZpZGVkLiAgQWxsIGFzc2VydGlvbiBtZXRob2RzIHByb3ZpZGVcbi8vIGJvdGggdGhlIGFjdHVhbCBhbmQgZXhwZWN0ZWQgdmFsdWVzIHRvIHRoZSBhc3NlcnRpb24gZXJyb3IgZm9yXG4vLyBkaXNwbGF5IHB1cnBvc2VzLlxuXG5mdW5jdGlvbiBmYWlsKGFjdHVhbCwgZXhwZWN0ZWQsIG1lc3NhZ2UsIG9wZXJhdG9yLCBzdGFja1N0YXJ0RnVuY3Rpb24pIHtcbiAgdGhyb3cgbmV3IGFzc2VydC5Bc3NlcnRpb25FcnJvcih7XG4gICAgbWVzc2FnZTogbWVzc2FnZSxcbiAgICBhY3R1YWw6IGFjdHVhbCxcbiAgICBleHBlY3RlZDogZXhwZWN0ZWQsXG4gICAgb3BlcmF0b3I6IG9wZXJhdG9yLFxuICAgIHN0YWNrU3RhcnRGdW5jdGlvbjogc3RhY2tTdGFydEZ1bmN0aW9uXG4gIH0pO1xufVxuXG4vLyBFWFRFTlNJT04hIGFsbG93cyBmb3Igd2VsbCBiZWhhdmVkIGVycm9ycyBkZWZpbmVkIGVsc2V3aGVyZS5cbmFzc2VydC5mYWlsID0gZmFpbDtcblxuLy8gNC4gUHVyZSBhc3NlcnRpb24gdGVzdHMgd2hldGhlciBhIHZhbHVlIGlzIHRydXRoeSwgYXMgZGV0ZXJtaW5lZFxuLy8gYnkgISFndWFyZC5cbi8vIGFzc2VydC5vayhndWFyZCwgbWVzc2FnZV9vcHQpO1xuLy8gVGhpcyBzdGF0ZW1lbnQgaXMgZXF1aXZhbGVudCB0byBhc3NlcnQuZXF1YWwodHJ1ZSwgISFndWFyZCxcbi8vIG1lc3NhZ2Vfb3B0KTsuIFRvIHRlc3Qgc3RyaWN0bHkgZm9yIHRoZSB2YWx1ZSB0cnVlLCB1c2Vcbi8vIGFzc2VydC5zdHJpY3RFcXVhbCh0cnVlLCBndWFyZCwgbWVzc2FnZV9vcHQpOy5cblxuZnVuY3Rpb24gb2sodmFsdWUsIG1lc3NhZ2UpIHtcbiAgaWYgKCF2YWx1ZSkgZmFpbCh2YWx1ZSwgdHJ1ZSwgbWVzc2FnZSwgJz09JywgYXNzZXJ0Lm9rKTtcbn1cbmFzc2VydC5vayA9IG9rO1xuXG4vLyA1LiBUaGUgZXF1YWxpdHkgYXNzZXJ0aW9uIHRlc3RzIHNoYWxsb3csIGNvZXJjaXZlIGVxdWFsaXR5IHdpdGhcbi8vID09LlxuLy8gYXNzZXJ0LmVxdWFsKGFjdHVhbCwgZXhwZWN0ZWQsIG1lc3NhZ2Vfb3B0KTtcblxuYXNzZXJ0LmVxdWFsID0gZnVuY3Rpb24gZXF1YWwoYWN0dWFsLCBleHBlY3RlZCwgbWVzc2FnZSkge1xuICBpZiAoYWN0dWFsICE9IGV4cGVjdGVkKSBmYWlsKGFjdHVhbCwgZXhwZWN0ZWQsIG1lc3NhZ2UsICc9PScsIGFzc2VydC5lcXVhbCk7XG59O1xuXG4vLyA2LiBUaGUgbm9uLWVxdWFsaXR5IGFzc2VydGlvbiB0ZXN0cyBmb3Igd2hldGhlciB0d28gb2JqZWN0cyBhcmUgbm90IGVxdWFsXG4vLyB3aXRoICE9IGFzc2VydC5ub3RFcXVhbChhY3R1YWwsIGV4cGVjdGVkLCBtZXNzYWdlX29wdCk7XG5cbmFzc2VydC5ub3RFcXVhbCA9IGZ1bmN0aW9uIG5vdEVxdWFsKGFjdHVhbCwgZXhwZWN0ZWQsIG1lc3NhZ2UpIHtcbiAgaWYgKGFjdHVhbCA9PSBleHBlY3RlZCkge1xuICAgIGZhaWwoYWN0dWFsLCBleHBlY3RlZCwgbWVzc2FnZSwgJyE9JywgYXNzZXJ0Lm5vdEVxdWFsKTtcbiAgfVxufTtcblxuLy8gNy4gVGhlIGVxdWl2YWxlbmNlIGFzc2VydGlvbiB0ZXN0cyBhIGRlZXAgZXF1YWxpdHkgcmVsYXRpb24uXG4vLyBhc3NlcnQuZGVlcEVxdWFsKGFjdHVhbCwgZXhwZWN0ZWQsIG1lc3NhZ2Vfb3B0KTtcblxuYXNzZXJ0LmRlZXBFcXVhbCA9IGZ1bmN0aW9uIGRlZXBFcXVhbChhY3R1YWwsIGV4cGVjdGVkLCBtZXNzYWdlKSB7XG4gIGlmICghX2RlZXBFcXVhbChhY3R1YWwsIGV4cGVjdGVkKSkge1xuICAgIGZhaWwoYWN0dWFsLCBleHBlY3RlZCwgbWVzc2FnZSwgJ2RlZXBFcXVhbCcsIGFzc2VydC5kZWVwRXF1YWwpO1xuICB9XG59O1xuXG5mdW5jdGlvbiBfZGVlcEVxdWFsKGFjdHVhbCwgZXhwZWN0ZWQpIHtcbiAgLy8gNy4xLiBBbGwgaWRlbnRpY2FsIHZhbHVlcyBhcmUgZXF1aXZhbGVudCwgYXMgZGV0ZXJtaW5lZCBieSA9PT0uXG4gIGlmIChhY3R1YWwgPT09IGV4cGVjdGVkKSB7XG4gICAgcmV0dXJuIHRydWU7XG5cbiAgfSBlbHNlIGlmICh1dGlsLmlzQnVmZmVyKGFjdHVhbCkgJiYgdXRpbC5pc0J1ZmZlcihleHBlY3RlZCkpIHtcbiAgICBpZiAoYWN0dWFsLmxlbmd0aCAhPSBleHBlY3RlZC5sZW5ndGgpIHJldHVybiBmYWxzZTtcblxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgYWN0dWFsLmxlbmd0aDsgaSsrKSB7XG4gICAgICBpZiAoYWN0dWFsW2ldICE9PSBleHBlY3RlZFtpXSkgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIHJldHVybiB0cnVlO1xuXG4gIC8vIDcuMi4gSWYgdGhlIGV4cGVjdGVkIHZhbHVlIGlzIGEgRGF0ZSBvYmplY3QsIHRoZSBhY3R1YWwgdmFsdWUgaXNcbiAgLy8gZXF1aXZhbGVudCBpZiBpdCBpcyBhbHNvIGEgRGF0ZSBvYmplY3QgdGhhdCByZWZlcnMgdG8gdGhlIHNhbWUgdGltZS5cbiAgfSBlbHNlIGlmICh1dGlsLmlzRGF0ZShhY3R1YWwpICYmIHV0aWwuaXNEYXRlKGV4cGVjdGVkKSkge1xuICAgIHJldHVybiBhY3R1YWwuZ2V0VGltZSgpID09PSBleHBlY3RlZC5nZXRUaW1lKCk7XG5cbiAgLy8gNy4zIElmIHRoZSBleHBlY3RlZCB2YWx1ZSBpcyBhIFJlZ0V4cCBvYmplY3QsIHRoZSBhY3R1YWwgdmFsdWUgaXNcbiAgLy8gZXF1aXZhbGVudCBpZiBpdCBpcyBhbHNvIGEgUmVnRXhwIG9iamVjdCB3aXRoIHRoZSBzYW1lIHNvdXJjZSBhbmRcbiAgLy8gcHJvcGVydGllcyAoYGdsb2JhbGAsIGBtdWx0aWxpbmVgLCBgbGFzdEluZGV4YCwgYGlnbm9yZUNhc2VgKS5cbiAgfSBlbHNlIGlmICh1dGlsLmlzUmVnRXhwKGFjdHVhbCkgJiYgdXRpbC5pc1JlZ0V4cChleHBlY3RlZCkpIHtcbiAgICByZXR1cm4gYWN0dWFsLnNvdXJjZSA9PT0gZXhwZWN0ZWQuc291cmNlICYmXG4gICAgICAgICAgIGFjdHVhbC5nbG9iYWwgPT09IGV4cGVjdGVkLmdsb2JhbCAmJlxuICAgICAgICAgICBhY3R1YWwubXVsdGlsaW5lID09PSBleHBlY3RlZC5tdWx0aWxpbmUgJiZcbiAgICAgICAgICAgYWN0dWFsLmxhc3RJbmRleCA9PT0gZXhwZWN0ZWQubGFzdEluZGV4ICYmXG4gICAgICAgICAgIGFjdHVhbC5pZ25vcmVDYXNlID09PSBleHBlY3RlZC5pZ25vcmVDYXNlO1xuXG4gIC8vIDcuNC4gT3RoZXIgcGFpcnMgdGhhdCBkbyBub3QgYm90aCBwYXNzIHR5cGVvZiB2YWx1ZSA9PSAnb2JqZWN0JyxcbiAgLy8gZXF1aXZhbGVuY2UgaXMgZGV0ZXJtaW5lZCBieSA9PS5cbiAgfSBlbHNlIGlmICghdXRpbC5pc09iamVjdChhY3R1YWwpICYmICF1dGlsLmlzT2JqZWN0KGV4cGVjdGVkKSkge1xuICAgIHJldHVybiBhY3R1YWwgPT0gZXhwZWN0ZWQ7XG5cbiAgLy8gNy41IEZvciBhbGwgb3RoZXIgT2JqZWN0IHBhaXJzLCBpbmNsdWRpbmcgQXJyYXkgb2JqZWN0cywgZXF1aXZhbGVuY2UgaXNcbiAgLy8gZGV0ZXJtaW5lZCBieSBoYXZpbmcgdGhlIHNhbWUgbnVtYmVyIG9mIG93bmVkIHByb3BlcnRpZXMgKGFzIHZlcmlmaWVkXG4gIC8vIHdpdGggT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKSwgdGhlIHNhbWUgc2V0IG9mIGtleXNcbiAgLy8gKGFsdGhvdWdoIG5vdCBuZWNlc3NhcmlseSB0aGUgc2FtZSBvcmRlciksIGVxdWl2YWxlbnQgdmFsdWVzIGZvciBldmVyeVxuICAvLyBjb3JyZXNwb25kaW5nIGtleSwgYW5kIGFuIGlkZW50aWNhbCAncHJvdG90eXBlJyBwcm9wZXJ0eS4gTm90ZTogdGhpc1xuICAvLyBhY2NvdW50cyBmb3IgYm90aCBuYW1lZCBhbmQgaW5kZXhlZCBwcm9wZXJ0aWVzIG9uIEFycmF5cy5cbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gb2JqRXF1aXYoYWN0dWFsLCBleHBlY3RlZCk7XG4gIH1cbn1cblxuZnVuY3Rpb24gaXNBcmd1bWVudHMob2JqZWN0KSB7XG4gIHJldHVybiBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwob2JqZWN0KSA9PSAnW29iamVjdCBBcmd1bWVudHNdJztcbn1cblxuZnVuY3Rpb24gb2JqRXF1aXYoYSwgYikge1xuICBpZiAodXRpbC5pc051bGxPclVuZGVmaW5lZChhKSB8fCB1dGlsLmlzTnVsbE9yVW5kZWZpbmVkKGIpKVxuICAgIHJldHVybiBmYWxzZTtcbiAgLy8gYW4gaWRlbnRpY2FsICdwcm90b3R5cGUnIHByb3BlcnR5LlxuICBpZiAoYS5wcm90b3R5cGUgIT09IGIucHJvdG90eXBlKSByZXR1cm4gZmFsc2U7XG4gIC8vIGlmIG9uZSBpcyBhIHByaW1pdGl2ZSwgdGhlIG90aGVyIG11c3QgYmUgc2FtZVxuICBpZiAodXRpbC5pc1ByaW1pdGl2ZShhKSB8fCB1dGlsLmlzUHJpbWl0aXZlKGIpKSB7XG4gICAgcmV0dXJuIGEgPT09IGI7XG4gIH1cbiAgdmFyIGFJc0FyZ3MgPSBpc0FyZ3VtZW50cyhhKSxcbiAgICAgIGJJc0FyZ3MgPSBpc0FyZ3VtZW50cyhiKTtcbiAgaWYgKChhSXNBcmdzICYmICFiSXNBcmdzKSB8fCAoIWFJc0FyZ3MgJiYgYklzQXJncykpXG4gICAgcmV0dXJuIGZhbHNlO1xuICBpZiAoYUlzQXJncykge1xuICAgIGEgPSBwU2xpY2UuY2FsbChhKTtcbiAgICBiID0gcFNsaWNlLmNhbGwoYik7XG4gICAgcmV0dXJuIF9kZWVwRXF1YWwoYSwgYik7XG4gIH1cbiAgdmFyIGthID0gb2JqZWN0S2V5cyhhKSxcbiAgICAgIGtiID0gb2JqZWN0S2V5cyhiKSxcbiAgICAgIGtleSwgaTtcbiAgLy8gaGF2aW5nIHRoZSBzYW1lIG51bWJlciBvZiBvd25lZCBwcm9wZXJ0aWVzIChrZXlzIGluY29ycG9yYXRlc1xuICAvLyBoYXNPd25Qcm9wZXJ0eSlcbiAgaWYgKGthLmxlbmd0aCAhPSBrYi5sZW5ndGgpXG4gICAgcmV0dXJuIGZhbHNlO1xuICAvL3RoZSBzYW1lIHNldCBvZiBrZXlzIChhbHRob3VnaCBub3QgbmVjZXNzYXJpbHkgdGhlIHNhbWUgb3JkZXIpLFxuICBrYS5zb3J0KCk7XG4gIGtiLnNvcnQoKTtcbiAgLy9+fn5jaGVhcCBrZXkgdGVzdFxuICBmb3IgKGkgPSBrYS5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xuICAgIGlmIChrYVtpXSAhPSBrYltpXSlcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICAvL2VxdWl2YWxlbnQgdmFsdWVzIGZvciBldmVyeSBjb3JyZXNwb25kaW5nIGtleSwgYW5kXG4gIC8vfn5+cG9zc2libHkgZXhwZW5zaXZlIGRlZXAgdGVzdFxuICBmb3IgKGkgPSBrYS5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xuICAgIGtleSA9IGthW2ldO1xuICAgIGlmICghX2RlZXBFcXVhbChhW2tleV0sIGJba2V5XSkpIHJldHVybiBmYWxzZTtcbiAgfVxuICByZXR1cm4gdHJ1ZTtcbn1cblxuLy8gOC4gVGhlIG5vbi1lcXVpdmFsZW5jZSBhc3NlcnRpb24gdGVzdHMgZm9yIGFueSBkZWVwIGluZXF1YWxpdHkuXG4vLyBhc3NlcnQubm90RGVlcEVxdWFsKGFjdHVhbCwgZXhwZWN0ZWQsIG1lc3NhZ2Vfb3B0KTtcblxuYXNzZXJ0Lm5vdERlZXBFcXVhbCA9IGZ1bmN0aW9uIG5vdERlZXBFcXVhbChhY3R1YWwsIGV4cGVjdGVkLCBtZXNzYWdlKSB7XG4gIGlmIChfZGVlcEVxdWFsKGFjdHVhbCwgZXhwZWN0ZWQpKSB7XG4gICAgZmFpbChhY3R1YWwsIGV4cGVjdGVkLCBtZXNzYWdlLCAnbm90RGVlcEVxdWFsJywgYXNzZXJ0Lm5vdERlZXBFcXVhbCk7XG4gIH1cbn07XG5cbi8vIDkuIFRoZSBzdHJpY3QgZXF1YWxpdHkgYXNzZXJ0aW9uIHRlc3RzIHN0cmljdCBlcXVhbGl0eSwgYXMgZGV0ZXJtaW5lZCBieSA9PT0uXG4vLyBhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsLCBleHBlY3RlZCwgbWVzc2FnZV9vcHQpO1xuXG5hc3NlcnQuc3RyaWN0RXF1YWwgPSBmdW5jdGlvbiBzdHJpY3RFcXVhbChhY3R1YWwsIGV4cGVjdGVkLCBtZXNzYWdlKSB7XG4gIGlmIChhY3R1YWwgIT09IGV4cGVjdGVkKSB7XG4gICAgZmFpbChhY3R1YWwsIGV4cGVjdGVkLCBtZXNzYWdlLCAnPT09JywgYXNzZXJ0LnN0cmljdEVxdWFsKTtcbiAgfVxufTtcblxuLy8gMTAuIFRoZSBzdHJpY3Qgbm9uLWVxdWFsaXR5IGFzc2VydGlvbiB0ZXN0cyBmb3Igc3RyaWN0IGluZXF1YWxpdHksIGFzXG4vLyBkZXRlcm1pbmVkIGJ5ICE9PS4gIGFzc2VydC5ub3RTdHJpY3RFcXVhbChhY3R1YWwsIGV4cGVjdGVkLCBtZXNzYWdlX29wdCk7XG5cbmFzc2VydC5ub3RTdHJpY3RFcXVhbCA9IGZ1bmN0aW9uIG5vdFN0cmljdEVxdWFsKGFjdHVhbCwgZXhwZWN0ZWQsIG1lc3NhZ2UpIHtcbiAgaWYgKGFjdHVhbCA9PT0gZXhwZWN0ZWQpIHtcbiAgICBmYWlsKGFjdHVhbCwgZXhwZWN0ZWQsIG1lc3NhZ2UsICchPT0nLCBhc3NlcnQubm90U3RyaWN0RXF1YWwpO1xuICB9XG59O1xuXG5mdW5jdGlvbiBleHBlY3RlZEV4Y2VwdGlvbihhY3R1YWwsIGV4cGVjdGVkKSB7XG4gIGlmICghYWN0dWFsIHx8ICFleHBlY3RlZCkge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIGlmIChPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwoZXhwZWN0ZWQpID09ICdbb2JqZWN0IFJlZ0V4cF0nKSB7XG4gICAgcmV0dXJuIGV4cGVjdGVkLnRlc3QoYWN0dWFsKTtcbiAgfSBlbHNlIGlmIChhY3R1YWwgaW5zdGFuY2VvZiBleHBlY3RlZCkge1xuICAgIHJldHVybiB0cnVlO1xuICB9IGVsc2UgaWYgKGV4cGVjdGVkLmNhbGwoe30sIGFjdHVhbCkgPT09IHRydWUpIHtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuXG4gIHJldHVybiBmYWxzZTtcbn1cblxuZnVuY3Rpb24gX3Rocm93cyhzaG91bGRUaHJvdywgYmxvY2ssIGV4cGVjdGVkLCBtZXNzYWdlKSB7XG4gIHZhciBhY3R1YWw7XG5cbiAgaWYgKHV0aWwuaXNTdHJpbmcoZXhwZWN0ZWQpKSB7XG4gICAgbWVzc2FnZSA9IGV4cGVjdGVkO1xuICAgIGV4cGVjdGVkID0gbnVsbDtcbiAgfVxuXG4gIHRyeSB7XG4gICAgYmxvY2soKTtcbiAgfSBjYXRjaCAoZSkge1xuICAgIGFjdHVhbCA9IGU7XG4gIH1cblxuICBtZXNzYWdlID0gKGV4cGVjdGVkICYmIGV4cGVjdGVkLm5hbWUgPyAnICgnICsgZXhwZWN0ZWQubmFtZSArICcpLicgOiAnLicpICtcbiAgICAgICAgICAgIChtZXNzYWdlID8gJyAnICsgbWVzc2FnZSA6ICcuJyk7XG5cbiAgaWYgKHNob3VsZFRocm93ICYmICFhY3R1YWwpIHtcbiAgICBmYWlsKGFjdHVhbCwgZXhwZWN0ZWQsICdNaXNzaW5nIGV4cGVjdGVkIGV4Y2VwdGlvbicgKyBtZXNzYWdlKTtcbiAgfVxuXG4gIGlmICghc2hvdWxkVGhyb3cgJiYgZXhwZWN0ZWRFeGNlcHRpb24oYWN0dWFsLCBleHBlY3RlZCkpIHtcbiAgICBmYWlsKGFjdHVhbCwgZXhwZWN0ZWQsICdHb3QgdW53YW50ZWQgZXhjZXB0aW9uJyArIG1lc3NhZ2UpO1xuICB9XG5cbiAgaWYgKChzaG91bGRUaHJvdyAmJiBhY3R1YWwgJiYgZXhwZWN0ZWQgJiZcbiAgICAgICFleHBlY3RlZEV4Y2VwdGlvbihhY3R1YWwsIGV4cGVjdGVkKSkgfHwgKCFzaG91bGRUaHJvdyAmJiBhY3R1YWwpKSB7XG4gICAgdGhyb3cgYWN0dWFsO1xuICB9XG59XG5cbi8vIDExLiBFeHBlY3RlZCB0byB0aHJvdyBhbiBlcnJvcjpcbi8vIGFzc2VydC50aHJvd3MoYmxvY2ssIEVycm9yX29wdCwgbWVzc2FnZV9vcHQpO1xuXG5hc3NlcnQudGhyb3dzID0gZnVuY3Rpb24oYmxvY2ssIC8qb3B0aW9uYWwqL2Vycm9yLCAvKm9wdGlvbmFsKi9tZXNzYWdlKSB7XG4gIF90aHJvd3MuYXBwbHkodGhpcywgW3RydWVdLmNvbmNhdChwU2xpY2UuY2FsbChhcmd1bWVudHMpKSk7XG59O1xuXG4vLyBFWFRFTlNJT04hIFRoaXMgaXMgYW5ub3lpbmcgdG8gd3JpdGUgb3V0c2lkZSB0aGlzIG1vZHVsZS5cbmFzc2VydC5kb2VzTm90VGhyb3cgPSBmdW5jdGlvbihibG9jaywgLypvcHRpb25hbCovbWVzc2FnZSkge1xuICBfdGhyb3dzLmFwcGx5KHRoaXMsIFtmYWxzZV0uY29uY2F0KHBTbGljZS5jYWxsKGFyZ3VtZW50cykpKTtcbn07XG5cbmFzc2VydC5pZkVycm9yID0gZnVuY3Rpb24oZXJyKSB7IGlmIChlcnIpIHt0aHJvdyBlcnI7fX07XG5cbnZhciBvYmplY3RLZXlzID0gT2JqZWN0LmtleXMgfHwgZnVuY3Rpb24gKG9iaikge1xuICB2YXIga2V5cyA9IFtdO1xuICBmb3IgKHZhciBrZXkgaW4gb2JqKSB7XG4gICAgaWYgKGhhc093bi5jYWxsKG9iaiwga2V5KSkga2V5cy5wdXNoKGtleSk7XG4gIH1cbiAgcmV0dXJuIGtleXM7XG59O1xuIiwiLy8gQ29weXJpZ2h0IEpveWVudCwgSW5jLiBhbmQgb3RoZXIgTm9kZSBjb250cmlidXRvcnMuXG4vL1xuLy8gUGVybWlzc2lvbiBpcyBoZXJlYnkgZ3JhbnRlZCwgZnJlZSBvZiBjaGFyZ2UsIHRvIGFueSBwZXJzb24gb2J0YWluaW5nIGFcbi8vIGNvcHkgb2YgdGhpcyBzb2Z0d2FyZSBhbmQgYXNzb2NpYXRlZCBkb2N1bWVudGF0aW9uIGZpbGVzICh0aGVcbi8vIFwiU29mdHdhcmVcIiksIHRvIGRlYWwgaW4gdGhlIFNvZnR3YXJlIHdpdGhvdXQgcmVzdHJpY3Rpb24sIGluY2x1ZGluZ1xuLy8gd2l0aG91dCBsaW1pdGF0aW9uIHRoZSByaWdodHMgdG8gdXNlLCBjb3B5LCBtb2RpZnksIG1lcmdlLCBwdWJsaXNoLFxuLy8gZGlzdHJpYnV0ZSwgc3VibGljZW5zZSwgYW5kL29yIHNlbGwgY29waWVzIG9mIHRoZSBTb2Z0d2FyZSwgYW5kIHRvIHBlcm1pdFxuLy8gcGVyc29ucyB0byB3aG9tIHRoZSBTb2Z0d2FyZSBpcyBmdXJuaXNoZWQgdG8gZG8gc28sIHN1YmplY3QgdG8gdGhlXG4vLyBmb2xsb3dpbmcgY29uZGl0aW9uczpcbi8vXG4vLyBUaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZFxuLy8gaW4gYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG4vL1xuLy8gVEhFIFNPRlRXQVJFIElTIFBST1ZJREVEIFwiQVMgSVNcIiwgV0lUSE9VVCBXQVJSQU5UWSBPRiBBTlkgS0lORCwgRVhQUkVTU1xuLy8gT1IgSU1QTElFRCwgSU5DTFVESU5HIEJVVCBOT1QgTElNSVRFRCBUTyBUSEUgV0FSUkFOVElFUyBPRlxuLy8gTUVSQ0hBTlRBQklMSVRZLCBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRSBBTkQgTk9OSU5GUklOR0VNRU5ULiBJTlxuLy8gTk8gRVZFTlQgU0hBTEwgVEhFIEFVVEhPUlMgT1IgQ09QWVJJR0hUIEhPTERFUlMgQkUgTElBQkxFIEZPUiBBTlkgQ0xBSU0sXG4vLyBEQU1BR0VTIE9SIE9USEVSIExJQUJJTElUWSwgV0hFVEhFUiBJTiBBTiBBQ1RJT04gT0YgQ09OVFJBQ1QsIFRPUlQgT1Jcbi8vIE9USEVSV0lTRSwgQVJJU0lORyBGUk9NLCBPVVQgT0YgT1IgSU4gQ09OTkVDVElPTiBXSVRIIFRIRSBTT0ZUV0FSRSBPUiBUSEVcbi8vIFVTRSBPUiBPVEhFUiBERUFMSU5HUyBJTiBUSEUgU09GVFdBUkUuXG5cbmZ1bmN0aW9uIEV2ZW50RW1pdHRlcigpIHtcbiAgdGhpcy5fZXZlbnRzID0gdGhpcy5fZXZlbnRzIHx8IHt9O1xuICB0aGlzLl9tYXhMaXN0ZW5lcnMgPSB0aGlzLl9tYXhMaXN0ZW5lcnMgfHwgdW5kZWZpbmVkO1xufVxubW9kdWxlLmV4cG9ydHMgPSBFdmVudEVtaXR0ZXI7XG5cbi8vIEJhY2t3YXJkcy1jb21wYXQgd2l0aCBub2RlIDAuMTAueFxuRXZlbnRFbWl0dGVyLkV2ZW50RW1pdHRlciA9IEV2ZW50RW1pdHRlcjtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5fZXZlbnRzID0gdW5kZWZpbmVkO1xuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5fbWF4TGlzdGVuZXJzID0gdW5kZWZpbmVkO1xuXG4vLyBCeSBkZWZhdWx0IEV2ZW50RW1pdHRlcnMgd2lsbCBwcmludCBhIHdhcm5pbmcgaWYgbW9yZSB0aGFuIDEwIGxpc3RlbmVycyBhcmVcbi8vIGFkZGVkIHRvIGl0LiBUaGlzIGlzIGEgdXNlZnVsIGRlZmF1bHQgd2hpY2ggaGVscHMgZmluZGluZyBtZW1vcnkgbGVha3MuXG5FdmVudEVtaXR0ZXIuZGVmYXVsdE1heExpc3RlbmVycyA9IDEwO1xuXG4vLyBPYnZpb3VzbHkgbm90IGFsbCBFbWl0dGVycyBzaG91bGQgYmUgbGltaXRlZCB0byAxMC4gVGhpcyBmdW5jdGlvbiBhbGxvd3Ncbi8vIHRoYXQgdG8gYmUgaW5jcmVhc2VkLiBTZXQgdG8gemVybyBmb3IgdW5saW1pdGVkLlxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5zZXRNYXhMaXN0ZW5lcnMgPSBmdW5jdGlvbihuKSB7XG4gIGlmICghaXNOdW1iZXIobikgfHwgbiA8IDAgfHwgaXNOYU4obikpXG4gICAgdGhyb3cgVHlwZUVycm9yKCduIG11c3QgYmUgYSBwb3NpdGl2ZSBudW1iZXInKTtcbiAgdGhpcy5fbWF4TGlzdGVuZXJzID0gbjtcbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLmVtaXQgPSBmdW5jdGlvbih0eXBlKSB7XG4gIHZhciBlciwgaGFuZGxlciwgbGVuLCBhcmdzLCBpLCBsaXN0ZW5lcnM7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMpXG4gICAgdGhpcy5fZXZlbnRzID0ge307XG5cbiAgLy8gSWYgdGhlcmUgaXMgbm8gJ2Vycm9yJyBldmVudCBsaXN0ZW5lciB0aGVuIHRocm93LlxuICBpZiAodHlwZSA9PT0gJ2Vycm9yJykge1xuICAgIGlmICghdGhpcy5fZXZlbnRzLmVycm9yIHx8XG4gICAgICAgIChpc09iamVjdCh0aGlzLl9ldmVudHMuZXJyb3IpICYmICF0aGlzLl9ldmVudHMuZXJyb3IubGVuZ3RoKSkge1xuICAgICAgZXIgPSBhcmd1bWVudHNbMV07XG4gICAgICBpZiAoZXIgaW5zdGFuY2VvZiBFcnJvcikge1xuICAgICAgICB0aHJvdyBlcjsgLy8gVW5oYW5kbGVkICdlcnJvcicgZXZlbnRcbiAgICAgIH1cbiAgICAgIHRocm93IFR5cGVFcnJvcignVW5jYXVnaHQsIHVuc3BlY2lmaWVkIFwiZXJyb3JcIiBldmVudC4nKTtcbiAgICB9XG4gIH1cblxuICBoYW5kbGVyID0gdGhpcy5fZXZlbnRzW3R5cGVdO1xuXG4gIGlmIChpc1VuZGVmaW5lZChoYW5kbGVyKSlcbiAgICByZXR1cm4gZmFsc2U7XG5cbiAgaWYgKGlzRnVuY3Rpb24oaGFuZGxlcikpIHtcbiAgICBzd2l0Y2ggKGFyZ3VtZW50cy5sZW5ndGgpIHtcbiAgICAgIC8vIGZhc3QgY2FzZXNcbiAgICAgIGNhc2UgMTpcbiAgICAgICAgaGFuZGxlci5jYWxsKHRoaXMpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgMjpcbiAgICAgICAgaGFuZGxlci5jYWxsKHRoaXMsIGFyZ3VtZW50c1sxXSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAzOlxuICAgICAgICBoYW5kbGVyLmNhbGwodGhpcywgYXJndW1lbnRzWzFdLCBhcmd1bWVudHNbMl0pO1xuICAgICAgICBicmVhaztcbiAgICAgIC8vIHNsb3dlclxuICAgICAgZGVmYXVsdDpcbiAgICAgICAgbGVuID0gYXJndW1lbnRzLmxlbmd0aDtcbiAgICAgICAgYXJncyA9IG5ldyBBcnJheShsZW4gLSAxKTtcbiAgICAgICAgZm9yIChpID0gMTsgaSA8IGxlbjsgaSsrKVxuICAgICAgICAgIGFyZ3NbaSAtIDFdID0gYXJndW1lbnRzW2ldO1xuICAgICAgICBoYW5kbGVyLmFwcGx5KHRoaXMsIGFyZ3MpO1xuICAgIH1cbiAgfSBlbHNlIGlmIChpc09iamVjdChoYW5kbGVyKSkge1xuICAgIGxlbiA9IGFyZ3VtZW50cy5sZW5ndGg7XG4gICAgYXJncyA9IG5ldyBBcnJheShsZW4gLSAxKTtcbiAgICBmb3IgKGkgPSAxOyBpIDwgbGVuOyBpKyspXG4gICAgICBhcmdzW2kgLSAxXSA9IGFyZ3VtZW50c1tpXTtcblxuICAgIGxpc3RlbmVycyA9IGhhbmRsZXIuc2xpY2UoKTtcbiAgICBsZW4gPSBsaXN0ZW5lcnMubGVuZ3RoO1xuICAgIGZvciAoaSA9IDA7IGkgPCBsZW47IGkrKylcbiAgICAgIGxpc3RlbmVyc1tpXS5hcHBseSh0aGlzLCBhcmdzKTtcbiAgfVxuXG4gIHJldHVybiB0cnVlO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5hZGRMaXN0ZW5lciA9IGZ1bmN0aW9uKHR5cGUsIGxpc3RlbmVyKSB7XG4gIHZhciBtO1xuXG4gIGlmICghaXNGdW5jdGlvbihsaXN0ZW5lcikpXG4gICAgdGhyb3cgVHlwZUVycm9yKCdsaXN0ZW5lciBtdXN0IGJlIGEgZnVuY3Rpb24nKTtcblxuICBpZiAoIXRoaXMuX2V2ZW50cylcbiAgICB0aGlzLl9ldmVudHMgPSB7fTtcblxuICAvLyBUbyBhdm9pZCByZWN1cnNpb24gaW4gdGhlIGNhc2UgdGhhdCB0eXBlID09PSBcIm5ld0xpc3RlbmVyXCIhIEJlZm9yZVxuICAvLyBhZGRpbmcgaXQgdG8gdGhlIGxpc3RlbmVycywgZmlyc3QgZW1pdCBcIm5ld0xpc3RlbmVyXCIuXG4gIGlmICh0aGlzLl9ldmVudHMubmV3TGlzdGVuZXIpXG4gICAgdGhpcy5lbWl0KCduZXdMaXN0ZW5lcicsIHR5cGUsXG4gICAgICAgICAgICAgIGlzRnVuY3Rpb24obGlzdGVuZXIubGlzdGVuZXIpID9cbiAgICAgICAgICAgICAgbGlzdGVuZXIubGlzdGVuZXIgOiBsaXN0ZW5lcik7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHNbdHlwZV0pXG4gICAgLy8gT3B0aW1pemUgdGhlIGNhc2Ugb2Ygb25lIGxpc3RlbmVyLiBEb24ndCBuZWVkIHRoZSBleHRyYSBhcnJheSBvYmplY3QuXG4gICAgdGhpcy5fZXZlbnRzW3R5cGVdID0gbGlzdGVuZXI7XG4gIGVsc2UgaWYgKGlzT2JqZWN0KHRoaXMuX2V2ZW50c1t0eXBlXSkpXG4gICAgLy8gSWYgd2UndmUgYWxyZWFkeSBnb3QgYW4gYXJyYXksIGp1c3QgYXBwZW5kLlxuICAgIHRoaXMuX2V2ZW50c1t0eXBlXS5wdXNoKGxpc3RlbmVyKTtcbiAgZWxzZVxuICAgIC8vIEFkZGluZyB0aGUgc2Vjb25kIGVsZW1lbnQsIG5lZWQgdG8gY2hhbmdlIHRvIGFycmF5LlxuICAgIHRoaXMuX2V2ZW50c1t0eXBlXSA9IFt0aGlzLl9ldmVudHNbdHlwZV0sIGxpc3RlbmVyXTtcblxuICAvLyBDaGVjayBmb3IgbGlzdGVuZXIgbGVha1xuICBpZiAoaXNPYmplY3QodGhpcy5fZXZlbnRzW3R5cGVdKSAmJiAhdGhpcy5fZXZlbnRzW3R5cGVdLndhcm5lZCkge1xuICAgIHZhciBtO1xuICAgIGlmICghaXNVbmRlZmluZWQodGhpcy5fbWF4TGlzdGVuZXJzKSkge1xuICAgICAgbSA9IHRoaXMuX21heExpc3RlbmVycztcbiAgICB9IGVsc2Uge1xuICAgICAgbSA9IEV2ZW50RW1pdHRlci5kZWZhdWx0TWF4TGlzdGVuZXJzO1xuICAgIH1cblxuICAgIGlmIChtICYmIG0gPiAwICYmIHRoaXMuX2V2ZW50c1t0eXBlXS5sZW5ndGggPiBtKSB7XG4gICAgICB0aGlzLl9ldmVudHNbdHlwZV0ud2FybmVkID0gdHJ1ZTtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJyhub2RlKSB3YXJuaW5nOiBwb3NzaWJsZSBFdmVudEVtaXR0ZXIgbWVtb3J5ICcgK1xuICAgICAgICAgICAgICAgICAgICAnbGVhayBkZXRlY3RlZC4gJWQgbGlzdGVuZXJzIGFkZGVkLiAnICtcbiAgICAgICAgICAgICAgICAgICAgJ1VzZSBlbWl0dGVyLnNldE1heExpc3RlbmVycygpIHRvIGluY3JlYXNlIGxpbWl0LicsXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2V2ZW50c1t0eXBlXS5sZW5ndGgpO1xuICAgICAgaWYgKHR5cGVvZiBjb25zb2xlLnRyYWNlID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIC8vIG5vdCBzdXBwb3J0ZWQgaW4gSUUgMTBcbiAgICAgICAgY29uc29sZS50cmFjZSgpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiB0aGlzO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5vbiA9IEV2ZW50RW1pdHRlci5wcm90b3R5cGUuYWRkTGlzdGVuZXI7XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUub25jZSA9IGZ1bmN0aW9uKHR5cGUsIGxpc3RlbmVyKSB7XG4gIGlmICghaXNGdW5jdGlvbihsaXN0ZW5lcikpXG4gICAgdGhyb3cgVHlwZUVycm9yKCdsaXN0ZW5lciBtdXN0IGJlIGEgZnVuY3Rpb24nKTtcblxuICB2YXIgZmlyZWQgPSBmYWxzZTtcblxuICBmdW5jdGlvbiBnKCkge1xuICAgIHRoaXMucmVtb3ZlTGlzdGVuZXIodHlwZSwgZyk7XG5cbiAgICBpZiAoIWZpcmVkKSB7XG4gICAgICBmaXJlZCA9IHRydWU7XG4gICAgICBsaXN0ZW5lci5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgIH1cbiAgfVxuXG4gIGcubGlzdGVuZXIgPSBsaXN0ZW5lcjtcbiAgdGhpcy5vbih0eXBlLCBnKTtcblxuICByZXR1cm4gdGhpcztcbn07XG5cbi8vIGVtaXRzIGEgJ3JlbW92ZUxpc3RlbmVyJyBldmVudCBpZmYgdGhlIGxpc3RlbmVyIHdhcyByZW1vdmVkXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLnJlbW92ZUxpc3RlbmVyID0gZnVuY3Rpb24odHlwZSwgbGlzdGVuZXIpIHtcbiAgdmFyIGxpc3QsIHBvc2l0aW9uLCBsZW5ndGgsIGk7XG5cbiAgaWYgKCFpc0Z1bmN0aW9uKGxpc3RlbmVyKSlcbiAgICB0aHJvdyBUeXBlRXJyb3IoJ2xpc3RlbmVyIG11c3QgYmUgYSBmdW5jdGlvbicpO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzIHx8ICF0aGlzLl9ldmVudHNbdHlwZV0pXG4gICAgcmV0dXJuIHRoaXM7XG5cbiAgbGlzdCA9IHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgbGVuZ3RoID0gbGlzdC5sZW5ndGg7XG4gIHBvc2l0aW9uID0gLTE7XG5cbiAgaWYgKGxpc3QgPT09IGxpc3RlbmVyIHx8XG4gICAgICAoaXNGdW5jdGlvbihsaXN0Lmxpc3RlbmVyKSAmJiBsaXN0Lmxpc3RlbmVyID09PSBsaXN0ZW5lcikpIHtcbiAgICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xuICAgIGlmICh0aGlzLl9ldmVudHMucmVtb3ZlTGlzdGVuZXIpXG4gICAgICB0aGlzLmVtaXQoJ3JlbW92ZUxpc3RlbmVyJywgdHlwZSwgbGlzdGVuZXIpO1xuXG4gIH0gZWxzZSBpZiAoaXNPYmplY3QobGlzdCkpIHtcbiAgICBmb3IgKGkgPSBsZW5ndGg7IGktLSA+IDA7KSB7XG4gICAgICBpZiAobGlzdFtpXSA9PT0gbGlzdGVuZXIgfHxcbiAgICAgICAgICAobGlzdFtpXS5saXN0ZW5lciAmJiBsaXN0W2ldLmxpc3RlbmVyID09PSBsaXN0ZW5lcikpIHtcbiAgICAgICAgcG9zaXRpb24gPSBpO1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAocG9zaXRpb24gPCAwKVxuICAgICAgcmV0dXJuIHRoaXM7XG5cbiAgICBpZiAobGlzdC5sZW5ndGggPT09IDEpIHtcbiAgICAgIGxpc3QubGVuZ3RoID0gMDtcbiAgICAgIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG4gICAgfSBlbHNlIHtcbiAgICAgIGxpc3Quc3BsaWNlKHBvc2l0aW9uLCAxKTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5fZXZlbnRzLnJlbW92ZUxpc3RlbmVyKVxuICAgICAgdGhpcy5lbWl0KCdyZW1vdmVMaXN0ZW5lcicsIHR5cGUsIGxpc3RlbmVyKTtcbiAgfVxuXG4gIHJldHVybiB0aGlzO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5yZW1vdmVBbGxMaXN0ZW5lcnMgPSBmdW5jdGlvbih0eXBlKSB7XG4gIHZhciBrZXksIGxpc3RlbmVycztcblxuICBpZiAoIXRoaXMuX2V2ZW50cylcbiAgICByZXR1cm4gdGhpcztcblxuICAvLyBub3QgbGlzdGVuaW5nIGZvciByZW1vdmVMaXN0ZW5lciwgbm8gbmVlZCB0byBlbWl0XG4gIGlmICghdGhpcy5fZXZlbnRzLnJlbW92ZUxpc3RlbmVyKSB7XG4gICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDApXG4gICAgICB0aGlzLl9ldmVudHMgPSB7fTtcbiAgICBlbHNlIGlmICh0aGlzLl9ldmVudHNbdHlwZV0pXG4gICAgICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLy8gZW1pdCByZW1vdmVMaXN0ZW5lciBmb3IgYWxsIGxpc3RlbmVycyBvbiBhbGwgZXZlbnRzXG4gIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAwKSB7XG4gICAgZm9yIChrZXkgaW4gdGhpcy5fZXZlbnRzKSB7XG4gICAgICBpZiAoa2V5ID09PSAncmVtb3ZlTGlzdGVuZXInKSBjb250aW51ZTtcbiAgICAgIHRoaXMucmVtb3ZlQWxsTGlzdGVuZXJzKGtleSk7XG4gICAgfVxuICAgIHRoaXMucmVtb3ZlQWxsTGlzdGVuZXJzKCdyZW1vdmVMaXN0ZW5lcicpO1xuICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgbGlzdGVuZXJzID0gdGhpcy5fZXZlbnRzW3R5cGVdO1xuXG4gIGlmIChpc0Z1bmN0aW9uKGxpc3RlbmVycykpIHtcbiAgICB0aGlzLnJlbW92ZUxpc3RlbmVyKHR5cGUsIGxpc3RlbmVycyk7XG4gIH0gZWxzZSB7XG4gICAgLy8gTElGTyBvcmRlclxuICAgIHdoaWxlIChsaXN0ZW5lcnMubGVuZ3RoKVxuICAgICAgdGhpcy5yZW1vdmVMaXN0ZW5lcih0eXBlLCBsaXN0ZW5lcnNbbGlzdGVuZXJzLmxlbmd0aCAtIDFdKTtcbiAgfVxuICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xuXG4gIHJldHVybiB0aGlzO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5saXN0ZW5lcnMgPSBmdW5jdGlvbih0eXBlKSB7XG4gIHZhciByZXQ7XG4gIGlmICghdGhpcy5fZXZlbnRzIHx8ICF0aGlzLl9ldmVudHNbdHlwZV0pXG4gICAgcmV0ID0gW107XG4gIGVsc2UgaWYgKGlzRnVuY3Rpb24odGhpcy5fZXZlbnRzW3R5cGVdKSlcbiAgICByZXQgPSBbdGhpcy5fZXZlbnRzW3R5cGVdXTtcbiAgZWxzZVxuICAgIHJldCA9IHRoaXMuX2V2ZW50c1t0eXBlXS5zbGljZSgpO1xuICByZXR1cm4gcmV0O1xufTtcblxuRXZlbnRFbWl0dGVyLmxpc3RlbmVyQ291bnQgPSBmdW5jdGlvbihlbWl0dGVyLCB0eXBlKSB7XG4gIHZhciByZXQ7XG4gIGlmICghZW1pdHRlci5fZXZlbnRzIHx8ICFlbWl0dGVyLl9ldmVudHNbdHlwZV0pXG4gICAgcmV0ID0gMDtcbiAgZWxzZSBpZiAoaXNGdW5jdGlvbihlbWl0dGVyLl9ldmVudHNbdHlwZV0pKVxuICAgIHJldCA9IDE7XG4gIGVsc2VcbiAgICByZXQgPSBlbWl0dGVyLl9ldmVudHNbdHlwZV0ubGVuZ3RoO1xuICByZXR1cm4gcmV0O1xufTtcblxuZnVuY3Rpb24gaXNGdW5jdGlvbihhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdmdW5jdGlvbic7XG59XG5cbmZ1bmN0aW9uIGlzTnVtYmVyKGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ251bWJlcic7XG59XG5cbmZ1bmN0aW9uIGlzT2JqZWN0KGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ29iamVjdCcgJiYgYXJnICE9PSBudWxsO1xufVxuXG5mdW5jdGlvbiBpc1VuZGVmaW5lZChhcmcpIHtcbiAgcmV0dXJuIGFyZyA9PT0gdm9pZCAwO1xufVxuIiwiaWYgKHR5cGVvZiBPYmplY3QuY3JlYXRlID09PSAnZnVuY3Rpb24nKSB7XG4gIC8vIGltcGxlbWVudGF0aW9uIGZyb20gc3RhbmRhcmQgbm9kZS5qcyAndXRpbCcgbW9kdWxlXG4gIG1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gaW5oZXJpdHMoY3Rvciwgc3VwZXJDdG9yKSB7XG4gICAgY3Rvci5zdXBlcl8gPSBzdXBlckN0b3JcbiAgICBjdG9yLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoc3VwZXJDdG9yLnByb3RvdHlwZSwge1xuICAgICAgY29uc3RydWN0b3I6IHtcbiAgICAgICAgdmFsdWU6IGN0b3IsXG4gICAgICAgIGVudW1lcmFibGU6IGZhbHNlLFxuICAgICAgICB3cml0YWJsZTogdHJ1ZSxcbiAgICAgICAgY29uZmlndXJhYmxlOiB0cnVlXG4gICAgICB9XG4gICAgfSk7XG4gIH07XG59IGVsc2Uge1xuICAvLyBvbGQgc2Nob29sIHNoaW0gZm9yIG9sZCBicm93c2Vyc1xuICBtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIGluaGVyaXRzKGN0b3IsIHN1cGVyQ3Rvcikge1xuICAgIGN0b3Iuc3VwZXJfID0gc3VwZXJDdG9yXG4gICAgdmFyIFRlbXBDdG9yID0gZnVuY3Rpb24gKCkge31cbiAgICBUZW1wQ3Rvci5wcm90b3R5cGUgPSBzdXBlckN0b3IucHJvdG90eXBlXG4gICAgY3Rvci5wcm90b3R5cGUgPSBuZXcgVGVtcEN0b3IoKVxuICAgIGN0b3IucHJvdG90eXBlLmNvbnN0cnVjdG9yID0gY3RvclxuICB9XG59XG4iLCIvLyBzaGltIGZvciB1c2luZyBwcm9jZXNzIGluIGJyb3dzZXJcblxudmFyIHByb2Nlc3MgPSBtb2R1bGUuZXhwb3J0cyA9IHt9O1xudmFyIHF1ZXVlID0gW107XG52YXIgZHJhaW5pbmcgPSBmYWxzZTtcbnZhciBjdXJyZW50UXVldWU7XG52YXIgcXVldWVJbmRleCA9IC0xO1xuXG5mdW5jdGlvbiBjbGVhblVwTmV4dFRpY2soKSB7XG4gICAgZHJhaW5pbmcgPSBmYWxzZTtcbiAgICBpZiAoY3VycmVudFF1ZXVlLmxlbmd0aCkge1xuICAgICAgICBxdWV1ZSA9IGN1cnJlbnRRdWV1ZS5jb25jYXQocXVldWUpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHF1ZXVlSW5kZXggPSAtMTtcbiAgICB9XG4gICAgaWYgKHF1ZXVlLmxlbmd0aCkge1xuICAgICAgICBkcmFpblF1ZXVlKCk7XG4gICAgfVxufVxuXG5mdW5jdGlvbiBkcmFpblF1ZXVlKCkge1xuICAgIGlmIChkcmFpbmluZykge1xuICAgICAgICByZXR1cm47XG4gICAgfVxuICAgIHZhciB0aW1lb3V0ID0gc2V0VGltZW91dChjbGVhblVwTmV4dFRpY2spO1xuICAgIGRyYWluaW5nID0gdHJ1ZTtcblxuICAgIHZhciBsZW4gPSBxdWV1ZS5sZW5ndGg7XG4gICAgd2hpbGUobGVuKSB7XG4gICAgICAgIGN1cnJlbnRRdWV1ZSA9IHF1ZXVlO1xuICAgICAgICBxdWV1ZSA9IFtdO1xuICAgICAgICB3aGlsZSAoKytxdWV1ZUluZGV4IDwgbGVuKSB7XG4gICAgICAgICAgICBpZiAoY3VycmVudFF1ZXVlKSB7XG4gICAgICAgICAgICAgICAgY3VycmVudFF1ZXVlW3F1ZXVlSW5kZXhdLnJ1bigpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHF1ZXVlSW5kZXggPSAtMTtcbiAgICAgICAgbGVuID0gcXVldWUubGVuZ3RoO1xuICAgIH1cbiAgICBjdXJyZW50UXVldWUgPSBudWxsO1xuICAgIGRyYWluaW5nID0gZmFsc2U7XG4gICAgY2xlYXJUaW1lb3V0KHRpbWVvdXQpO1xufVxuXG5wcm9jZXNzLm5leHRUaWNrID0gZnVuY3Rpb24gKGZ1bikge1xuICAgIHZhciBhcmdzID0gbmV3IEFycmF5KGFyZ3VtZW50cy5sZW5ndGggLSAxKTtcbiAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgZm9yICh2YXIgaSA9IDE7IGkgPCBhcmd1bWVudHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGFyZ3NbaSAtIDFdID0gYXJndW1lbnRzW2ldO1xuICAgICAgICB9XG4gICAgfVxuICAgIHF1ZXVlLnB1c2gobmV3IEl0ZW0oZnVuLCBhcmdzKSk7XG4gICAgaWYgKHF1ZXVlLmxlbmd0aCA9PT0gMSAmJiAhZHJhaW5pbmcpIHtcbiAgICAgICAgc2V0VGltZW91dChkcmFpblF1ZXVlLCAwKTtcbiAgICB9XG59O1xuXG4vLyB2OCBsaWtlcyBwcmVkaWN0aWJsZSBvYmplY3RzXG5mdW5jdGlvbiBJdGVtKGZ1biwgYXJyYXkpIHtcbiAgICB0aGlzLmZ1biA9IGZ1bjtcbiAgICB0aGlzLmFycmF5ID0gYXJyYXk7XG59XG5JdGVtLnByb3RvdHlwZS5ydW4gPSBmdW5jdGlvbiAoKSB7XG4gICAgdGhpcy5mdW4uYXBwbHkobnVsbCwgdGhpcy5hcnJheSk7XG59O1xucHJvY2Vzcy50aXRsZSA9ICdicm93c2VyJztcbnByb2Nlc3MuYnJvd3NlciA9IHRydWU7XG5wcm9jZXNzLmVudiA9IHt9O1xucHJvY2Vzcy5hcmd2ID0gW107XG5wcm9jZXNzLnZlcnNpb24gPSAnJzsgLy8gZW1wdHkgc3RyaW5nIHRvIGF2b2lkIHJlZ2V4cCBpc3N1ZXNcbnByb2Nlc3MudmVyc2lvbnMgPSB7fTtcblxuZnVuY3Rpb24gbm9vcCgpIHt9XG5cbnByb2Nlc3Mub24gPSBub29wO1xucHJvY2Vzcy5hZGRMaXN0ZW5lciA9IG5vb3A7XG5wcm9jZXNzLm9uY2UgPSBub29wO1xucHJvY2Vzcy5vZmYgPSBub29wO1xucHJvY2Vzcy5yZW1vdmVMaXN0ZW5lciA9IG5vb3A7XG5wcm9jZXNzLnJlbW92ZUFsbExpc3RlbmVycyA9IG5vb3A7XG5wcm9jZXNzLmVtaXQgPSBub29wO1xuXG5wcm9jZXNzLmJpbmRpbmcgPSBmdW5jdGlvbiAobmFtZSkge1xuICAgIHRocm93IG5ldyBFcnJvcigncHJvY2Vzcy5iaW5kaW5nIGlzIG5vdCBzdXBwb3J0ZWQnKTtcbn07XG5cbnByb2Nlc3MuY3dkID0gZnVuY3Rpb24gKCkgeyByZXR1cm4gJy8nIH07XG5wcm9jZXNzLmNoZGlyID0gZnVuY3Rpb24gKGRpcikge1xuICAgIHRocm93IG5ldyBFcnJvcigncHJvY2Vzcy5jaGRpciBpcyBub3Qgc3VwcG9ydGVkJyk7XG59O1xucHJvY2Vzcy51bWFzayA9IGZ1bmN0aW9uKCkgeyByZXR1cm4gMDsgfTtcbiIsIm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gaXNCdWZmZXIoYXJnKSB7XG4gIHJldHVybiBhcmcgJiYgdHlwZW9mIGFyZyA9PT0gJ29iamVjdCdcbiAgICAmJiB0eXBlb2YgYXJnLmNvcHkgPT09ICdmdW5jdGlvbidcbiAgICAmJiB0eXBlb2YgYXJnLmZpbGwgPT09ICdmdW5jdGlvbidcbiAgICAmJiB0eXBlb2YgYXJnLnJlYWRVSW50OCA9PT0gJ2Z1bmN0aW9uJztcbn0iLCIvLyBDb3B5cmlnaHQgSm95ZW50LCBJbmMuIGFuZCBvdGhlciBOb2RlIGNvbnRyaWJ1dG9ycy5cbi8vXG4vLyBQZXJtaXNzaW9uIGlzIGhlcmVieSBncmFudGVkLCBmcmVlIG9mIGNoYXJnZSwgdG8gYW55IHBlcnNvbiBvYnRhaW5pbmcgYVxuLy8gY29weSBvZiB0aGlzIHNvZnR3YXJlIGFuZCBhc3NvY2lhdGVkIGRvY3VtZW50YXRpb24gZmlsZXMgKHRoZVxuLy8gXCJTb2Z0d2FyZVwiKSwgdG8gZGVhbCBpbiB0aGUgU29mdHdhcmUgd2l0aG91dCByZXN0cmljdGlvbiwgaW5jbHVkaW5nXG4vLyB3aXRob3V0IGxpbWl0YXRpb24gdGhlIHJpZ2h0cyB0byB1c2UsIGNvcHksIG1vZGlmeSwgbWVyZ2UsIHB1Ymxpc2gsXG4vLyBkaXN0cmlidXRlLCBzdWJsaWNlbnNlLCBhbmQvb3Igc2VsbCBjb3BpZXMgb2YgdGhlIFNvZnR3YXJlLCBhbmQgdG8gcGVybWl0XG4vLyBwZXJzb25zIHRvIHdob20gdGhlIFNvZnR3YXJlIGlzIGZ1cm5pc2hlZCB0byBkbyBzbywgc3ViamVjdCB0byB0aGVcbi8vIGZvbGxvd2luZyBjb25kaXRpb25zOlxuLy9cbi8vIFRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlIGFuZCB0aGlzIHBlcm1pc3Npb24gbm90aWNlIHNoYWxsIGJlIGluY2x1ZGVkXG4vLyBpbiBhbGwgY29waWVzIG9yIHN1YnN0YW50aWFsIHBvcnRpb25zIG9mIHRoZSBTb2Z0d2FyZS5cbi8vXG4vLyBUSEUgU09GVFdBUkUgSVMgUFJPVklERUQgXCJBUyBJU1wiLCBXSVRIT1VUIFdBUlJBTlRZIE9GIEFOWSBLSU5ELCBFWFBSRVNTXG4vLyBPUiBJTVBMSUVELCBJTkNMVURJTkcgQlVUIE5PVCBMSU1JVEVEIFRPIFRIRSBXQVJSQU5USUVTIE9GXG4vLyBNRVJDSEFOVEFCSUxJVFksIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFIEFORCBOT05JTkZSSU5HRU1FTlQuIElOXG4vLyBOTyBFVkVOVCBTSEFMTCBUSEUgQVVUSE9SUyBPUiBDT1BZUklHSFQgSE9MREVSUyBCRSBMSUFCTEUgRk9SIEFOWSBDTEFJTSxcbi8vIERBTUFHRVMgT1IgT1RIRVIgTElBQklMSVRZLCBXSEVUSEVSIElOIEFOIEFDVElPTiBPRiBDT05UUkFDVCwgVE9SVCBPUlxuLy8gT1RIRVJXSVNFLCBBUklTSU5HIEZST00sIE9VVCBPRiBPUiBJTiBDT05ORUNUSU9OIFdJVEggVEhFIFNPRlRXQVJFIE9SIFRIRVxuLy8gVVNFIE9SIE9USEVSIERFQUxJTkdTIElOIFRIRSBTT0ZUV0FSRS5cblxudmFyIGZvcm1hdFJlZ0V4cCA9IC8lW3NkaiVdL2c7XG5leHBvcnRzLmZvcm1hdCA9IGZ1bmN0aW9uKGYpIHtcbiAgaWYgKCFpc1N0cmluZyhmKSkge1xuICAgIHZhciBvYmplY3RzID0gW107XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBhcmd1bWVudHMubGVuZ3RoOyBpKyspIHtcbiAgICAgIG9iamVjdHMucHVzaChpbnNwZWN0KGFyZ3VtZW50c1tpXSkpO1xuICAgIH1cbiAgICByZXR1cm4gb2JqZWN0cy5qb2luKCcgJyk7XG4gIH1cblxuICB2YXIgaSA9IDE7XG4gIHZhciBhcmdzID0gYXJndW1lbnRzO1xuICB2YXIgbGVuID0gYXJncy5sZW5ndGg7XG4gIHZhciBzdHIgPSBTdHJpbmcoZikucmVwbGFjZShmb3JtYXRSZWdFeHAsIGZ1bmN0aW9uKHgpIHtcbiAgICBpZiAoeCA9PT0gJyUlJykgcmV0dXJuICclJztcbiAgICBpZiAoaSA+PSBsZW4pIHJldHVybiB4O1xuICAgIHN3aXRjaCAoeCkge1xuICAgICAgY2FzZSAnJXMnOiByZXR1cm4gU3RyaW5nKGFyZ3NbaSsrXSk7XG4gICAgICBjYXNlICclZCc6IHJldHVybiBOdW1iZXIoYXJnc1tpKytdKTtcbiAgICAgIGNhc2UgJyVqJzpcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoYXJnc1tpKytdKTtcbiAgICAgICAgfSBjYXRjaCAoXykge1xuICAgICAgICAgIHJldHVybiAnW0NpcmN1bGFyXSc7XG4gICAgICAgIH1cbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIHJldHVybiB4O1xuICAgIH1cbiAgfSk7XG4gIGZvciAodmFyIHggPSBhcmdzW2ldOyBpIDwgbGVuOyB4ID0gYXJnc1srK2ldKSB7XG4gICAgaWYgKGlzTnVsbCh4KSB8fCAhaXNPYmplY3QoeCkpIHtcbiAgICAgIHN0ciArPSAnICcgKyB4O1xuICAgIH0gZWxzZSB7XG4gICAgICBzdHIgKz0gJyAnICsgaW5zcGVjdCh4KTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIHN0cjtcbn07XG5cblxuLy8gTWFyayB0aGF0IGEgbWV0aG9kIHNob3VsZCBub3QgYmUgdXNlZC5cbi8vIFJldHVybnMgYSBtb2RpZmllZCBmdW5jdGlvbiB3aGljaCB3YXJucyBvbmNlIGJ5IGRlZmF1bHQuXG4vLyBJZiAtLW5vLWRlcHJlY2F0aW9uIGlzIHNldCwgdGhlbiBpdCBpcyBhIG5vLW9wLlxuZXhwb3J0cy5kZXByZWNhdGUgPSBmdW5jdGlvbihmbiwgbXNnKSB7XG4gIC8vIEFsbG93IGZvciBkZXByZWNhdGluZyB0aGluZ3MgaW4gdGhlIHByb2Nlc3Mgb2Ygc3RhcnRpbmcgdXAuXG4gIGlmIChpc1VuZGVmaW5lZChnbG9iYWwucHJvY2VzcykpIHtcbiAgICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gZXhwb3J0cy5kZXByZWNhdGUoZm4sIG1zZykuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICB9O1xuICB9XG5cbiAgaWYgKHByb2Nlc3Mubm9EZXByZWNhdGlvbiA9PT0gdHJ1ZSkge1xuICAgIHJldHVybiBmbjtcbiAgfVxuXG4gIHZhciB3YXJuZWQgPSBmYWxzZTtcbiAgZnVuY3Rpb24gZGVwcmVjYXRlZCgpIHtcbiAgICBpZiAoIXdhcm5lZCkge1xuICAgICAgaWYgKHByb2Nlc3MudGhyb3dEZXByZWNhdGlvbikge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IobXNnKTtcbiAgICAgIH0gZWxzZSBpZiAocHJvY2Vzcy50cmFjZURlcHJlY2F0aW9uKSB7XG4gICAgICAgIGNvbnNvbGUudHJhY2UobXNnKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IobXNnKTtcbiAgICAgIH1cbiAgICAgIHdhcm5lZCA9IHRydWU7XG4gICAgfVxuICAgIHJldHVybiBmbi5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICB9XG5cbiAgcmV0dXJuIGRlcHJlY2F0ZWQ7XG59O1xuXG5cbnZhciBkZWJ1Z3MgPSB7fTtcbnZhciBkZWJ1Z0Vudmlyb247XG5leHBvcnRzLmRlYnVnbG9nID0gZnVuY3Rpb24oc2V0KSB7XG4gIGlmIChpc1VuZGVmaW5lZChkZWJ1Z0Vudmlyb24pKVxuICAgIGRlYnVnRW52aXJvbiA9IHByb2Nlc3MuZW52Lk5PREVfREVCVUcgfHwgJyc7XG4gIHNldCA9IHNldC50b1VwcGVyQ2FzZSgpO1xuICBpZiAoIWRlYnVnc1tzZXRdKSB7XG4gICAgaWYgKG5ldyBSZWdFeHAoJ1xcXFxiJyArIHNldCArICdcXFxcYicsICdpJykudGVzdChkZWJ1Z0Vudmlyb24pKSB7XG4gICAgICB2YXIgcGlkID0gcHJvY2Vzcy5waWQ7XG4gICAgICBkZWJ1Z3Nbc2V0XSA9IGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgbXNnID0gZXhwb3J0cy5mb3JtYXQuYXBwbHkoZXhwb3J0cywgYXJndW1lbnRzKTtcbiAgICAgICAgY29uc29sZS5lcnJvcignJXMgJWQ6ICVzJywgc2V0LCBwaWQsIG1zZyk7XG4gICAgICB9O1xuICAgIH0gZWxzZSB7XG4gICAgICBkZWJ1Z3Nbc2V0XSA9IGZ1bmN0aW9uKCkge307XG4gICAgfVxuICB9XG4gIHJldHVybiBkZWJ1Z3Nbc2V0XTtcbn07XG5cblxuLyoqXG4gKiBFY2hvcyB0aGUgdmFsdWUgb2YgYSB2YWx1ZS4gVHJ5cyB0byBwcmludCB0aGUgdmFsdWUgb3V0XG4gKiBpbiB0aGUgYmVzdCB3YXkgcG9zc2libGUgZ2l2ZW4gdGhlIGRpZmZlcmVudCB0eXBlcy5cbiAqXG4gKiBAcGFyYW0ge09iamVjdH0gb2JqIFRoZSBvYmplY3QgdG8gcHJpbnQgb3V0LlxuICogQHBhcmFtIHtPYmplY3R9IG9wdHMgT3B0aW9uYWwgb3B0aW9ucyBvYmplY3QgdGhhdCBhbHRlcnMgdGhlIG91dHB1dC5cbiAqL1xuLyogbGVnYWN5OiBvYmosIHNob3dIaWRkZW4sIGRlcHRoLCBjb2xvcnMqL1xuZnVuY3Rpb24gaW5zcGVjdChvYmosIG9wdHMpIHtcbiAgLy8gZGVmYXVsdCBvcHRpb25zXG4gIHZhciBjdHggPSB7XG4gICAgc2VlbjogW10sXG4gICAgc3R5bGl6ZTogc3R5bGl6ZU5vQ29sb3JcbiAgfTtcbiAgLy8gbGVnYWN5Li4uXG4gIGlmIChhcmd1bWVudHMubGVuZ3RoID49IDMpIGN0eC5kZXB0aCA9IGFyZ3VtZW50c1syXTtcbiAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPj0gNCkgY3R4LmNvbG9ycyA9IGFyZ3VtZW50c1szXTtcbiAgaWYgKGlzQm9vbGVhbihvcHRzKSkge1xuICAgIC8vIGxlZ2FjeS4uLlxuICAgIGN0eC5zaG93SGlkZGVuID0gb3B0cztcbiAgfSBlbHNlIGlmIChvcHRzKSB7XG4gICAgLy8gZ290IGFuIFwib3B0aW9uc1wiIG9iamVjdFxuICAgIGV4cG9ydHMuX2V4dGVuZChjdHgsIG9wdHMpO1xuICB9XG4gIC8vIHNldCBkZWZhdWx0IG9wdGlvbnNcbiAgaWYgKGlzVW5kZWZpbmVkKGN0eC5zaG93SGlkZGVuKSkgY3R4LnNob3dIaWRkZW4gPSBmYWxzZTtcbiAgaWYgKGlzVW5kZWZpbmVkKGN0eC5kZXB0aCkpIGN0eC5kZXB0aCA9IDI7XG4gIGlmIChpc1VuZGVmaW5lZChjdHguY29sb3JzKSkgY3R4LmNvbG9ycyA9IGZhbHNlO1xuICBpZiAoaXNVbmRlZmluZWQoY3R4LmN1c3RvbUluc3BlY3QpKSBjdHguY3VzdG9tSW5zcGVjdCA9IHRydWU7XG4gIGlmIChjdHguY29sb3JzKSBjdHguc3R5bGl6ZSA9IHN0eWxpemVXaXRoQ29sb3I7XG4gIHJldHVybiBmb3JtYXRWYWx1ZShjdHgsIG9iaiwgY3R4LmRlcHRoKTtcbn1cbmV4cG9ydHMuaW5zcGVjdCA9IGluc3BlY3Q7XG5cblxuLy8gaHR0cDovL2VuLndpa2lwZWRpYS5vcmcvd2lraS9BTlNJX2VzY2FwZV9jb2RlI2dyYXBoaWNzXG5pbnNwZWN0LmNvbG9ycyA9IHtcbiAgJ2JvbGQnIDogWzEsIDIyXSxcbiAgJ2l0YWxpYycgOiBbMywgMjNdLFxuICAndW5kZXJsaW5lJyA6IFs0LCAyNF0sXG4gICdpbnZlcnNlJyA6IFs3LCAyN10sXG4gICd3aGl0ZScgOiBbMzcsIDM5XSxcbiAgJ2dyZXknIDogWzkwLCAzOV0sXG4gICdibGFjaycgOiBbMzAsIDM5XSxcbiAgJ2JsdWUnIDogWzM0LCAzOV0sXG4gICdjeWFuJyA6IFszNiwgMzldLFxuICAnZ3JlZW4nIDogWzMyLCAzOV0sXG4gICdtYWdlbnRhJyA6IFszNSwgMzldLFxuICAncmVkJyA6IFszMSwgMzldLFxuICAneWVsbG93JyA6IFszMywgMzldXG59O1xuXG4vLyBEb24ndCB1c2UgJ2JsdWUnIG5vdCB2aXNpYmxlIG9uIGNtZC5leGVcbmluc3BlY3Quc3R5bGVzID0ge1xuICAnc3BlY2lhbCc6ICdjeWFuJyxcbiAgJ251bWJlcic6ICd5ZWxsb3cnLFxuICAnYm9vbGVhbic6ICd5ZWxsb3cnLFxuICAndW5kZWZpbmVkJzogJ2dyZXknLFxuICAnbnVsbCc6ICdib2xkJyxcbiAgJ3N0cmluZyc6ICdncmVlbicsXG4gICdkYXRlJzogJ21hZ2VudGEnLFxuICAvLyBcIm5hbWVcIjogaW50ZW50aW9uYWxseSBub3Qgc3R5bGluZ1xuICAncmVnZXhwJzogJ3JlZCdcbn07XG5cblxuZnVuY3Rpb24gc3R5bGl6ZVdpdGhDb2xvcihzdHIsIHN0eWxlVHlwZSkge1xuICB2YXIgc3R5bGUgPSBpbnNwZWN0LnN0eWxlc1tzdHlsZVR5cGVdO1xuXG4gIGlmIChzdHlsZSkge1xuICAgIHJldHVybiAnXFx1MDAxYlsnICsgaW5zcGVjdC5jb2xvcnNbc3R5bGVdWzBdICsgJ20nICsgc3RyICtcbiAgICAgICAgICAgJ1xcdTAwMWJbJyArIGluc3BlY3QuY29sb3JzW3N0eWxlXVsxXSArICdtJztcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gc3RyO1xuICB9XG59XG5cblxuZnVuY3Rpb24gc3R5bGl6ZU5vQ29sb3Ioc3RyLCBzdHlsZVR5cGUpIHtcbiAgcmV0dXJuIHN0cjtcbn1cblxuXG5mdW5jdGlvbiBhcnJheVRvSGFzaChhcnJheSkge1xuICB2YXIgaGFzaCA9IHt9O1xuXG4gIGFycmF5LmZvckVhY2goZnVuY3Rpb24odmFsLCBpZHgpIHtcbiAgICBoYXNoW3ZhbF0gPSB0cnVlO1xuICB9KTtcblxuICByZXR1cm4gaGFzaDtcbn1cblxuXG5mdW5jdGlvbiBmb3JtYXRWYWx1ZShjdHgsIHZhbHVlLCByZWN1cnNlVGltZXMpIHtcbiAgLy8gUHJvdmlkZSBhIGhvb2sgZm9yIHVzZXItc3BlY2lmaWVkIGluc3BlY3QgZnVuY3Rpb25zLlxuICAvLyBDaGVjayB0aGF0IHZhbHVlIGlzIGFuIG9iamVjdCB3aXRoIGFuIGluc3BlY3QgZnVuY3Rpb24gb24gaXRcbiAgaWYgKGN0eC5jdXN0b21JbnNwZWN0ICYmXG4gICAgICB2YWx1ZSAmJlxuICAgICAgaXNGdW5jdGlvbih2YWx1ZS5pbnNwZWN0KSAmJlxuICAgICAgLy8gRmlsdGVyIG91dCB0aGUgdXRpbCBtb2R1bGUsIGl0J3MgaW5zcGVjdCBmdW5jdGlvbiBpcyBzcGVjaWFsXG4gICAgICB2YWx1ZS5pbnNwZWN0ICE9PSBleHBvcnRzLmluc3BlY3QgJiZcbiAgICAgIC8vIEFsc28gZmlsdGVyIG91dCBhbnkgcHJvdG90eXBlIG9iamVjdHMgdXNpbmcgdGhlIGNpcmN1bGFyIGNoZWNrLlxuICAgICAgISh2YWx1ZS5jb25zdHJ1Y3RvciAmJiB2YWx1ZS5jb25zdHJ1Y3Rvci5wcm90b3R5cGUgPT09IHZhbHVlKSkge1xuICAgIHZhciByZXQgPSB2YWx1ZS5pbnNwZWN0KHJlY3Vyc2VUaW1lcywgY3R4KTtcbiAgICBpZiAoIWlzU3RyaW5nKHJldCkpIHtcbiAgICAgIHJldCA9IGZvcm1hdFZhbHVlKGN0eCwgcmV0LCByZWN1cnNlVGltZXMpO1xuICAgIH1cbiAgICByZXR1cm4gcmV0O1xuICB9XG5cbiAgLy8gUHJpbWl0aXZlIHR5cGVzIGNhbm5vdCBoYXZlIHByb3BlcnRpZXNcbiAgdmFyIHByaW1pdGl2ZSA9IGZvcm1hdFByaW1pdGl2ZShjdHgsIHZhbHVlKTtcbiAgaWYgKHByaW1pdGl2ZSkge1xuICAgIHJldHVybiBwcmltaXRpdmU7XG4gIH1cblxuICAvLyBMb29rIHVwIHRoZSBrZXlzIG9mIHRoZSBvYmplY3QuXG4gIHZhciBrZXlzID0gT2JqZWN0LmtleXModmFsdWUpO1xuICB2YXIgdmlzaWJsZUtleXMgPSBhcnJheVRvSGFzaChrZXlzKTtcblxuICBpZiAoY3R4LnNob3dIaWRkZW4pIHtcbiAgICBrZXlzID0gT2JqZWN0LmdldE93blByb3BlcnR5TmFtZXModmFsdWUpO1xuICB9XG5cbiAgLy8gSUUgZG9lc24ndCBtYWtlIGVycm9yIGZpZWxkcyBub24tZW51bWVyYWJsZVxuICAvLyBodHRwOi8vbXNkbi5taWNyb3NvZnQuY29tL2VuLXVzL2xpYnJhcnkvaWUvZHd3NTJzYnQodj12cy45NCkuYXNweFxuICBpZiAoaXNFcnJvcih2YWx1ZSlcbiAgICAgICYmIChrZXlzLmluZGV4T2YoJ21lc3NhZ2UnKSA+PSAwIHx8IGtleXMuaW5kZXhPZignZGVzY3JpcHRpb24nKSA+PSAwKSkge1xuICAgIHJldHVybiBmb3JtYXRFcnJvcih2YWx1ZSk7XG4gIH1cblxuICAvLyBTb21lIHR5cGUgb2Ygb2JqZWN0IHdpdGhvdXQgcHJvcGVydGllcyBjYW4gYmUgc2hvcnRjdXR0ZWQuXG4gIGlmIChrZXlzLmxlbmd0aCA9PT0gMCkge1xuICAgIGlmIChpc0Z1bmN0aW9uKHZhbHVlKSkge1xuICAgICAgdmFyIG5hbWUgPSB2YWx1ZS5uYW1lID8gJzogJyArIHZhbHVlLm5hbWUgOiAnJztcbiAgICAgIHJldHVybiBjdHguc3R5bGl6ZSgnW0Z1bmN0aW9uJyArIG5hbWUgKyAnXScsICdzcGVjaWFsJyk7XG4gICAgfVxuICAgIGlmIChpc1JlZ0V4cCh2YWx1ZSkpIHtcbiAgICAgIHJldHVybiBjdHguc3R5bGl6ZShSZWdFeHAucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwodmFsdWUpLCAncmVnZXhwJyk7XG4gICAgfVxuICAgIGlmIChpc0RhdGUodmFsdWUpKSB7XG4gICAgICByZXR1cm4gY3R4LnN0eWxpemUoRGF0ZS5wcm90b3R5cGUudG9TdHJpbmcuY2FsbCh2YWx1ZSksICdkYXRlJyk7XG4gICAgfVxuICAgIGlmIChpc0Vycm9yKHZhbHVlKSkge1xuICAgICAgcmV0dXJuIGZvcm1hdEVycm9yKHZhbHVlKTtcbiAgICB9XG4gIH1cblxuICB2YXIgYmFzZSA9ICcnLCBhcnJheSA9IGZhbHNlLCBicmFjZXMgPSBbJ3snLCAnfSddO1xuXG4gIC8vIE1ha2UgQXJyYXkgc2F5IHRoYXQgdGhleSBhcmUgQXJyYXlcbiAgaWYgKGlzQXJyYXkodmFsdWUpKSB7XG4gICAgYXJyYXkgPSB0cnVlO1xuICAgIGJyYWNlcyA9IFsnWycsICddJ107XG4gIH1cblxuICAvLyBNYWtlIGZ1bmN0aW9ucyBzYXkgdGhhdCB0aGV5IGFyZSBmdW5jdGlvbnNcbiAgaWYgKGlzRnVuY3Rpb24odmFsdWUpKSB7XG4gICAgdmFyIG4gPSB2YWx1ZS5uYW1lID8gJzogJyArIHZhbHVlLm5hbWUgOiAnJztcbiAgICBiYXNlID0gJyBbRnVuY3Rpb24nICsgbiArICddJztcbiAgfVxuXG4gIC8vIE1ha2UgUmVnRXhwcyBzYXkgdGhhdCB0aGV5IGFyZSBSZWdFeHBzXG4gIGlmIChpc1JlZ0V4cCh2YWx1ZSkpIHtcbiAgICBiYXNlID0gJyAnICsgUmVnRXhwLnByb3RvdHlwZS50b1N0cmluZy5jYWxsKHZhbHVlKTtcbiAgfVxuXG4gIC8vIE1ha2UgZGF0ZXMgd2l0aCBwcm9wZXJ0aWVzIGZpcnN0IHNheSB0aGUgZGF0ZVxuICBpZiAoaXNEYXRlKHZhbHVlKSkge1xuICAgIGJhc2UgPSAnICcgKyBEYXRlLnByb3RvdHlwZS50b1VUQ1N0cmluZy5jYWxsKHZhbHVlKTtcbiAgfVxuXG4gIC8vIE1ha2UgZXJyb3Igd2l0aCBtZXNzYWdlIGZpcnN0IHNheSB0aGUgZXJyb3JcbiAgaWYgKGlzRXJyb3IodmFsdWUpKSB7XG4gICAgYmFzZSA9ICcgJyArIGZvcm1hdEVycm9yKHZhbHVlKTtcbiAgfVxuXG4gIGlmIChrZXlzLmxlbmd0aCA9PT0gMCAmJiAoIWFycmF5IHx8IHZhbHVlLmxlbmd0aCA9PSAwKSkge1xuICAgIHJldHVybiBicmFjZXNbMF0gKyBiYXNlICsgYnJhY2VzWzFdO1xuICB9XG5cbiAgaWYgKHJlY3Vyc2VUaW1lcyA8IDApIHtcbiAgICBpZiAoaXNSZWdFeHAodmFsdWUpKSB7XG4gICAgICByZXR1cm4gY3R4LnN0eWxpemUoUmVnRXhwLnByb3RvdHlwZS50b1N0cmluZy5jYWxsKHZhbHVlKSwgJ3JlZ2V4cCcpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gY3R4LnN0eWxpemUoJ1tPYmplY3RdJywgJ3NwZWNpYWwnKTtcbiAgICB9XG4gIH1cblxuICBjdHguc2Vlbi5wdXNoKHZhbHVlKTtcblxuICB2YXIgb3V0cHV0O1xuICBpZiAoYXJyYXkpIHtcbiAgICBvdXRwdXQgPSBmb3JtYXRBcnJheShjdHgsIHZhbHVlLCByZWN1cnNlVGltZXMsIHZpc2libGVLZXlzLCBrZXlzKTtcbiAgfSBlbHNlIHtcbiAgICBvdXRwdXQgPSBrZXlzLm1hcChmdW5jdGlvbihrZXkpIHtcbiAgICAgIHJldHVybiBmb3JtYXRQcm9wZXJ0eShjdHgsIHZhbHVlLCByZWN1cnNlVGltZXMsIHZpc2libGVLZXlzLCBrZXksIGFycmF5KTtcbiAgICB9KTtcbiAgfVxuXG4gIGN0eC5zZWVuLnBvcCgpO1xuXG4gIHJldHVybiByZWR1Y2VUb1NpbmdsZVN0cmluZyhvdXRwdXQsIGJhc2UsIGJyYWNlcyk7XG59XG5cblxuZnVuY3Rpb24gZm9ybWF0UHJpbWl0aXZlKGN0eCwgdmFsdWUpIHtcbiAgaWYgKGlzVW5kZWZpbmVkKHZhbHVlKSlcbiAgICByZXR1cm4gY3R4LnN0eWxpemUoJ3VuZGVmaW5lZCcsICd1bmRlZmluZWQnKTtcbiAgaWYgKGlzU3RyaW5nKHZhbHVlKSkge1xuICAgIHZhciBzaW1wbGUgPSAnXFwnJyArIEpTT04uc3RyaW5naWZ5KHZhbHVlKS5yZXBsYWNlKC9eXCJ8XCIkL2csICcnKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLnJlcGxhY2UoLycvZywgXCJcXFxcJ1wiKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLnJlcGxhY2UoL1xcXFxcIi9nLCAnXCInKSArICdcXCcnO1xuICAgIHJldHVybiBjdHguc3R5bGl6ZShzaW1wbGUsICdzdHJpbmcnKTtcbiAgfVxuICBpZiAoaXNOdW1iZXIodmFsdWUpKVxuICAgIHJldHVybiBjdHguc3R5bGl6ZSgnJyArIHZhbHVlLCAnbnVtYmVyJyk7XG4gIGlmIChpc0Jvb2xlYW4odmFsdWUpKVxuICAgIHJldHVybiBjdHguc3R5bGl6ZSgnJyArIHZhbHVlLCAnYm9vbGVhbicpO1xuICAvLyBGb3Igc29tZSByZWFzb24gdHlwZW9mIG51bGwgaXMgXCJvYmplY3RcIiwgc28gc3BlY2lhbCBjYXNlIGhlcmUuXG4gIGlmIChpc051bGwodmFsdWUpKVxuICAgIHJldHVybiBjdHguc3R5bGl6ZSgnbnVsbCcsICdudWxsJyk7XG59XG5cblxuZnVuY3Rpb24gZm9ybWF0RXJyb3IodmFsdWUpIHtcbiAgcmV0dXJuICdbJyArIEVycm9yLnByb3RvdHlwZS50b1N0cmluZy5jYWxsKHZhbHVlKSArICddJztcbn1cblxuXG5mdW5jdGlvbiBmb3JtYXRBcnJheShjdHgsIHZhbHVlLCByZWN1cnNlVGltZXMsIHZpc2libGVLZXlzLCBrZXlzKSB7XG4gIHZhciBvdXRwdXQgPSBbXTtcbiAgZm9yICh2YXIgaSA9IDAsIGwgPSB2YWx1ZS5sZW5ndGg7IGkgPCBsOyArK2kpIHtcbiAgICBpZiAoaGFzT3duUHJvcGVydHkodmFsdWUsIFN0cmluZyhpKSkpIHtcbiAgICAgIG91dHB1dC5wdXNoKGZvcm1hdFByb3BlcnR5KGN0eCwgdmFsdWUsIHJlY3Vyc2VUaW1lcywgdmlzaWJsZUtleXMsXG4gICAgICAgICAgU3RyaW5nKGkpLCB0cnVlKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIG91dHB1dC5wdXNoKCcnKTtcbiAgICB9XG4gIH1cbiAga2V5cy5mb3JFYWNoKGZ1bmN0aW9uKGtleSkge1xuICAgIGlmICgha2V5Lm1hdGNoKC9eXFxkKyQvKSkge1xuICAgICAgb3V0cHV0LnB1c2goZm9ybWF0UHJvcGVydHkoY3R4LCB2YWx1ZSwgcmVjdXJzZVRpbWVzLCB2aXNpYmxlS2V5cyxcbiAgICAgICAgICBrZXksIHRydWUpKTtcbiAgICB9XG4gIH0pO1xuICByZXR1cm4gb3V0cHV0O1xufVxuXG5cbmZ1bmN0aW9uIGZvcm1hdFByb3BlcnR5KGN0eCwgdmFsdWUsIHJlY3Vyc2VUaW1lcywgdmlzaWJsZUtleXMsIGtleSwgYXJyYXkpIHtcbiAgdmFyIG5hbWUsIHN0ciwgZGVzYztcbiAgZGVzYyA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3IodmFsdWUsIGtleSkgfHwgeyB2YWx1ZTogdmFsdWVba2V5XSB9O1xuICBpZiAoZGVzYy5nZXQpIHtcbiAgICBpZiAoZGVzYy5zZXQpIHtcbiAgICAgIHN0ciA9IGN0eC5zdHlsaXplKCdbR2V0dGVyL1NldHRlcl0nLCAnc3BlY2lhbCcpO1xuICAgIH0gZWxzZSB7XG4gICAgICBzdHIgPSBjdHguc3R5bGl6ZSgnW0dldHRlcl0nLCAnc3BlY2lhbCcpO1xuICAgIH1cbiAgfSBlbHNlIHtcbiAgICBpZiAoZGVzYy5zZXQpIHtcbiAgICAgIHN0ciA9IGN0eC5zdHlsaXplKCdbU2V0dGVyXScsICdzcGVjaWFsJyk7XG4gICAgfVxuICB9XG4gIGlmICghaGFzT3duUHJvcGVydHkodmlzaWJsZUtleXMsIGtleSkpIHtcbiAgICBuYW1lID0gJ1snICsga2V5ICsgJ10nO1xuICB9XG4gIGlmICghc3RyKSB7XG4gICAgaWYgKGN0eC5zZWVuLmluZGV4T2YoZGVzYy52YWx1ZSkgPCAwKSB7XG4gICAgICBpZiAoaXNOdWxsKHJlY3Vyc2VUaW1lcykpIHtcbiAgICAgICAgc3RyID0gZm9ybWF0VmFsdWUoY3R4LCBkZXNjLnZhbHVlLCBudWxsKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHN0ciA9IGZvcm1hdFZhbHVlKGN0eCwgZGVzYy52YWx1ZSwgcmVjdXJzZVRpbWVzIC0gMSk7XG4gICAgICB9XG4gICAgICBpZiAoc3RyLmluZGV4T2YoJ1xcbicpID4gLTEpIHtcbiAgICAgICAgaWYgKGFycmF5KSB7XG4gICAgICAgICAgc3RyID0gc3RyLnNwbGl0KCdcXG4nKS5tYXAoZnVuY3Rpb24obGluZSkge1xuICAgICAgICAgICAgcmV0dXJuICcgICcgKyBsaW5lO1xuICAgICAgICAgIH0pLmpvaW4oJ1xcbicpLnN1YnN0cigyKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBzdHIgPSAnXFxuJyArIHN0ci5zcGxpdCgnXFxuJykubWFwKGZ1bmN0aW9uKGxpbmUpIHtcbiAgICAgICAgICAgIHJldHVybiAnICAgJyArIGxpbmU7XG4gICAgICAgICAgfSkuam9pbignXFxuJyk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgc3RyID0gY3R4LnN0eWxpemUoJ1tDaXJjdWxhcl0nLCAnc3BlY2lhbCcpO1xuICAgIH1cbiAgfVxuICBpZiAoaXNVbmRlZmluZWQobmFtZSkpIHtcbiAgICBpZiAoYXJyYXkgJiYga2V5Lm1hdGNoKC9eXFxkKyQvKSkge1xuICAgICAgcmV0dXJuIHN0cjtcbiAgICB9XG4gICAgbmFtZSA9IEpTT04uc3RyaW5naWZ5KCcnICsga2V5KTtcbiAgICBpZiAobmFtZS5tYXRjaCgvXlwiKFthLXpBLVpfXVthLXpBLVpfMC05XSopXCIkLykpIHtcbiAgICAgIG5hbWUgPSBuYW1lLnN1YnN0cigxLCBuYW1lLmxlbmd0aCAtIDIpO1xuICAgICAgbmFtZSA9IGN0eC5zdHlsaXplKG5hbWUsICduYW1lJyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIG5hbWUgPSBuYW1lLnJlcGxhY2UoLycvZywgXCJcXFxcJ1wiKVxuICAgICAgICAgICAgICAgICAucmVwbGFjZSgvXFxcXFwiL2csICdcIicpXG4gICAgICAgICAgICAgICAgIC5yZXBsYWNlKC8oXlwifFwiJCkvZywgXCInXCIpO1xuICAgICAgbmFtZSA9IGN0eC5zdHlsaXplKG5hbWUsICdzdHJpbmcnKTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gbmFtZSArICc6ICcgKyBzdHI7XG59XG5cblxuZnVuY3Rpb24gcmVkdWNlVG9TaW5nbGVTdHJpbmcob3V0cHV0LCBiYXNlLCBicmFjZXMpIHtcbiAgdmFyIG51bUxpbmVzRXN0ID0gMDtcbiAgdmFyIGxlbmd0aCA9IG91dHB1dC5yZWR1Y2UoZnVuY3Rpb24ocHJldiwgY3VyKSB7XG4gICAgbnVtTGluZXNFc3QrKztcbiAgICBpZiAoY3VyLmluZGV4T2YoJ1xcbicpID49IDApIG51bUxpbmVzRXN0Kys7XG4gICAgcmV0dXJuIHByZXYgKyBjdXIucmVwbGFjZSgvXFx1MDAxYlxcW1xcZFxcZD9tL2csICcnKS5sZW5ndGggKyAxO1xuICB9LCAwKTtcblxuICBpZiAobGVuZ3RoID4gNjApIHtcbiAgICByZXR1cm4gYnJhY2VzWzBdICtcbiAgICAgICAgICAgKGJhc2UgPT09ICcnID8gJycgOiBiYXNlICsgJ1xcbiAnKSArXG4gICAgICAgICAgICcgJyArXG4gICAgICAgICAgIG91dHB1dC5qb2luKCcsXFxuICAnKSArXG4gICAgICAgICAgICcgJyArXG4gICAgICAgICAgIGJyYWNlc1sxXTtcbiAgfVxuXG4gIHJldHVybiBicmFjZXNbMF0gKyBiYXNlICsgJyAnICsgb3V0cHV0LmpvaW4oJywgJykgKyAnICcgKyBicmFjZXNbMV07XG59XG5cblxuLy8gTk9URTogVGhlc2UgdHlwZSBjaGVja2luZyBmdW5jdGlvbnMgaW50ZW50aW9uYWxseSBkb24ndCB1c2UgYGluc3RhbmNlb2ZgXG4vLyBiZWNhdXNlIGl0IGlzIGZyYWdpbGUgYW5kIGNhbiBiZSBlYXNpbHkgZmFrZWQgd2l0aCBgT2JqZWN0LmNyZWF0ZSgpYC5cbmZ1bmN0aW9uIGlzQXJyYXkoYXIpIHtcbiAgcmV0dXJuIEFycmF5LmlzQXJyYXkoYXIpO1xufVxuZXhwb3J0cy5pc0FycmF5ID0gaXNBcnJheTtcblxuZnVuY3Rpb24gaXNCb29sZWFuKGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ2Jvb2xlYW4nO1xufVxuZXhwb3J0cy5pc0Jvb2xlYW4gPSBpc0Jvb2xlYW47XG5cbmZ1bmN0aW9uIGlzTnVsbChhcmcpIHtcbiAgcmV0dXJuIGFyZyA9PT0gbnVsbDtcbn1cbmV4cG9ydHMuaXNOdWxsID0gaXNOdWxsO1xuXG5mdW5jdGlvbiBpc051bGxPclVuZGVmaW5lZChhcmcpIHtcbiAgcmV0dXJuIGFyZyA9PSBudWxsO1xufVxuZXhwb3J0cy5pc051bGxPclVuZGVmaW5lZCA9IGlzTnVsbE9yVW5kZWZpbmVkO1xuXG5mdW5jdGlvbiBpc051bWJlcihhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdudW1iZXInO1xufVxuZXhwb3J0cy5pc051bWJlciA9IGlzTnVtYmVyO1xuXG5mdW5jdGlvbiBpc1N0cmluZyhhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdzdHJpbmcnO1xufVxuZXhwb3J0cy5pc1N0cmluZyA9IGlzU3RyaW5nO1xuXG5mdW5jdGlvbiBpc1N5bWJvbChhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdzeW1ib2wnO1xufVxuZXhwb3J0cy5pc1N5bWJvbCA9IGlzU3ltYm9sO1xuXG5mdW5jdGlvbiBpc1VuZGVmaW5lZChhcmcpIHtcbiAgcmV0dXJuIGFyZyA9PT0gdm9pZCAwO1xufVxuZXhwb3J0cy5pc1VuZGVmaW5lZCA9IGlzVW5kZWZpbmVkO1xuXG5mdW5jdGlvbiBpc1JlZ0V4cChyZSkge1xuICByZXR1cm4gaXNPYmplY3QocmUpICYmIG9iamVjdFRvU3RyaW5nKHJlKSA9PT0gJ1tvYmplY3QgUmVnRXhwXSc7XG59XG5leHBvcnRzLmlzUmVnRXhwID0gaXNSZWdFeHA7XG5cbmZ1bmN0aW9uIGlzT2JqZWN0KGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ29iamVjdCcgJiYgYXJnICE9PSBudWxsO1xufVxuZXhwb3J0cy5pc09iamVjdCA9IGlzT2JqZWN0O1xuXG5mdW5jdGlvbiBpc0RhdGUoZCkge1xuICByZXR1cm4gaXNPYmplY3QoZCkgJiYgb2JqZWN0VG9TdHJpbmcoZCkgPT09ICdbb2JqZWN0IERhdGVdJztcbn1cbmV4cG9ydHMuaXNEYXRlID0gaXNEYXRlO1xuXG5mdW5jdGlvbiBpc0Vycm9yKGUpIHtcbiAgcmV0dXJuIGlzT2JqZWN0KGUpICYmXG4gICAgICAob2JqZWN0VG9TdHJpbmcoZSkgPT09ICdbb2JqZWN0IEVycm9yXScgfHwgZSBpbnN0YW5jZW9mIEVycm9yKTtcbn1cbmV4cG9ydHMuaXNFcnJvciA9IGlzRXJyb3I7XG5cbmZ1bmN0aW9uIGlzRnVuY3Rpb24oYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnZnVuY3Rpb24nO1xufVxuZXhwb3J0cy5pc0Z1bmN0aW9uID0gaXNGdW5jdGlvbjtcblxuZnVuY3Rpb24gaXNQcmltaXRpdmUoYXJnKSB7XG4gIHJldHVybiBhcmcgPT09IG51bGwgfHxcbiAgICAgICAgIHR5cGVvZiBhcmcgPT09ICdib29sZWFuJyB8fFxuICAgICAgICAgdHlwZW9mIGFyZyA9PT0gJ251bWJlcicgfHxcbiAgICAgICAgIHR5cGVvZiBhcmcgPT09ICdzdHJpbmcnIHx8XG4gICAgICAgICB0eXBlb2YgYXJnID09PSAnc3ltYm9sJyB8fCAgLy8gRVM2IHN5bWJvbFxuICAgICAgICAgdHlwZW9mIGFyZyA9PT0gJ3VuZGVmaW5lZCc7XG59XG5leHBvcnRzLmlzUHJpbWl0aXZlID0gaXNQcmltaXRpdmU7XG5cbmV4cG9ydHMuaXNCdWZmZXIgPSByZXF1aXJlKCcuL3N1cHBvcnQvaXNCdWZmZXInKTtcblxuZnVuY3Rpb24gb2JqZWN0VG9TdHJpbmcobykge1xuICByZXR1cm4gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKG8pO1xufVxuXG5cbmZ1bmN0aW9uIHBhZChuKSB7XG4gIHJldHVybiBuIDwgMTAgPyAnMCcgKyBuLnRvU3RyaW5nKDEwKSA6IG4udG9TdHJpbmcoMTApO1xufVxuXG5cbnZhciBtb250aHMgPSBbJ0phbicsICdGZWInLCAnTWFyJywgJ0FwcicsICdNYXknLCAnSnVuJywgJ0p1bCcsICdBdWcnLCAnU2VwJyxcbiAgICAgICAgICAgICAgJ09jdCcsICdOb3YnLCAnRGVjJ107XG5cbi8vIDI2IEZlYiAxNjoxOTozNFxuZnVuY3Rpb24gdGltZXN0YW1wKCkge1xuICB2YXIgZCA9IG5ldyBEYXRlKCk7XG4gIHZhciB0aW1lID0gW3BhZChkLmdldEhvdXJzKCkpLFxuICAgICAgICAgICAgICBwYWQoZC5nZXRNaW51dGVzKCkpLFxuICAgICAgICAgICAgICBwYWQoZC5nZXRTZWNvbmRzKCkpXS5qb2luKCc6Jyk7XG4gIHJldHVybiBbZC5nZXREYXRlKCksIG1vbnRoc1tkLmdldE1vbnRoKCldLCB0aW1lXS5qb2luKCcgJyk7XG59XG5cblxuLy8gbG9nIGlzIGp1c3QgYSB0aGluIHdyYXBwZXIgdG8gY29uc29sZS5sb2cgdGhhdCBwcmVwZW5kcyBhIHRpbWVzdGFtcFxuZXhwb3J0cy5sb2cgPSBmdW5jdGlvbigpIHtcbiAgY29uc29sZS5sb2coJyVzIC0gJXMnLCB0aW1lc3RhbXAoKSwgZXhwb3J0cy5mb3JtYXQuYXBwbHkoZXhwb3J0cywgYXJndW1lbnRzKSk7XG59O1xuXG5cbi8qKlxuICogSW5oZXJpdCB0aGUgcHJvdG90eXBlIG1ldGhvZHMgZnJvbSBvbmUgY29uc3RydWN0b3IgaW50byBhbm90aGVyLlxuICpcbiAqIFRoZSBGdW5jdGlvbi5wcm90b3R5cGUuaW5oZXJpdHMgZnJvbSBsYW5nLmpzIHJld3JpdHRlbiBhcyBhIHN0YW5kYWxvbmVcbiAqIGZ1bmN0aW9uIChub3Qgb24gRnVuY3Rpb24ucHJvdG90eXBlKS4gTk9URTogSWYgdGhpcyBmaWxlIGlzIHRvIGJlIGxvYWRlZFxuICogZHVyaW5nIGJvb3RzdHJhcHBpbmcgdGhpcyBmdW5jdGlvbiBuZWVkcyB0byBiZSByZXdyaXR0ZW4gdXNpbmcgc29tZSBuYXRpdmVcbiAqIGZ1bmN0aW9ucyBhcyBwcm90b3R5cGUgc2V0dXAgdXNpbmcgbm9ybWFsIEphdmFTY3JpcHQgZG9lcyBub3Qgd29yayBhc1xuICogZXhwZWN0ZWQgZHVyaW5nIGJvb3RzdHJhcHBpbmcgKHNlZSBtaXJyb3IuanMgaW4gcjExNDkwMykuXG4gKlxuICogQHBhcmFtIHtmdW5jdGlvbn0gY3RvciBDb25zdHJ1Y3RvciBmdW5jdGlvbiB3aGljaCBuZWVkcyB0byBpbmhlcml0IHRoZVxuICogICAgIHByb3RvdHlwZS5cbiAqIEBwYXJhbSB7ZnVuY3Rpb259IHN1cGVyQ3RvciBDb25zdHJ1Y3RvciBmdW5jdGlvbiB0byBpbmhlcml0IHByb3RvdHlwZSBmcm9tLlxuICovXG5leHBvcnRzLmluaGVyaXRzID0gcmVxdWlyZSgnaW5oZXJpdHMnKTtcblxuZXhwb3J0cy5fZXh0ZW5kID0gZnVuY3Rpb24ob3JpZ2luLCBhZGQpIHtcbiAgLy8gRG9uJ3QgZG8gYW55dGhpbmcgaWYgYWRkIGlzbid0IGFuIG9iamVjdFxuICBpZiAoIWFkZCB8fCAhaXNPYmplY3QoYWRkKSkgcmV0dXJuIG9yaWdpbjtcblxuICB2YXIga2V5cyA9IE9iamVjdC5rZXlzKGFkZCk7XG4gIHZhciBpID0ga2V5cy5sZW5ndGg7XG4gIHdoaWxlIChpLS0pIHtcbiAgICBvcmlnaW5ba2V5c1tpXV0gPSBhZGRba2V5c1tpXV07XG4gIH1cbiAgcmV0dXJuIG9yaWdpbjtcbn07XG5cbmZ1bmN0aW9uIGhhc093blByb3BlcnR5KG9iaiwgcHJvcCkge1xuICByZXR1cm4gT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKG9iaiwgcHJvcCk7XG59XG4iLCJ2YXIgYXNzZXJ0ID0gcmVxdWlyZShcImFzc2VydFwiKTtcbnZhciBodHRwICAgPSByZXF1aXJlKFwiLi4vY2xpZW50XCIpO1xuXG52YXIgX3VpZCA9IDA7XG5mdW5jdGlvbiB1aWQgKCkgeyByZXR1cm4gX3VpZCsrOyB9XG5cbmZ1bmN0aW9uIGNyZWF0ZUVsICh0YWcsIGF0dHJzKSB7XG5cdHZhciBlbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQodGFnKTtcblx0Zm9yICh2YXIgbmFtZSBpbiBhdHRycykgZWwuc2V0QXR0cmlidXRlKG5hbWUsIGF0dHJzW25hbWVdKTtcblx0ZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChlbCk7XG5cdHJldHVybiBlbDtcbn1cblxuZnVuY3Rpb24gY2xpY2tFbCAoZWwpIHtcbiAgICB2YXIgZXYgPSBkb2N1bWVudC5jcmVhdGVFdmVudChcIk1vdXNlRXZlbnRcIik7XG4gICAgZXYuaW5pdE1vdXNlRXZlbnQoXCJjbGlja1wiLCB0cnVlLCB0cnVlLCB3aW5kb3csIG51bGwsIDAsIDAsIDAsIDAsIGZhbHNlLCBmYWxzZSwgZmFsc2UsIGZhbHNlLCAwICwgbnVsbCk7XG4gICAgZWwuZGlzcGF0Y2hFdmVudChldik7XG59O1xuXG5mdW5jdGlvbiBvbkNsaWNrIChlbCwgZm4sIGFsbG93RGVmYXVsdCkge1xuXHR3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsIGZ1bmN0aW9uIF9oYW5kbGVDbGljayAoZSkge1xuXHRcdGlmICghYWxsb3dEZWZhdWx0KSBlLnByZXZlbnREZWZhdWx0KCk7XG5cdFx0d2luZG93LnJlbW92ZUV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCBfaGFuZGxlQ2xpY2spO1xuXHR9KTtcblx0ZWwuYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsIGZuKTtcbn1cblxuZnVuY3Rpb24gYWZ0ZXJDbGljayAoZWwsIGZuLCBhbGxvd0RlZmF1bHQpIHtcblx0b25DbGljayhlbCwgZnVuY3Rpb24gKCkgeyBzZXRUaW1lb3V0KGZ1bmN0aW9uICgpIHsgZm4oKSB9LCAxKTsgfSwgYWxsb3dEZWZhdWx0KTtcbn1cblxuZnVuY3Rpb24gb25TdWJtaXQgKGVsLCBmbiwgYWxsb3dEZWZhdWx0KSB7XG5cdHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKFwic3VibWl0XCIsIGZ1bmN0aW9uIF9oYW5kbGVTdWJtaXQgKGUpIHtcblx0XHRpZiAoIWFsbG93RGVmYXVsdCkgZS5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdHdpbmRvdy5yZW1vdmVFdmVudExpc3RlbmVyKFwic3VibWl0XCIsIF9oYW5kbGVTdWJtaXQpO1xuXHR9KTtcblx0ZWwuYWRkRXZlbnRMaXN0ZW5lcihcInN1Ym1pdFwiLCBmbik7XG59XG5cbmZ1bmN0aW9uIGFmdGVyU3VibWl0IChlbCwgZm4sIGFsbG93RGVmYXVsdCkge1xuXHRvblN1Ym1pdChlbCwgZnVuY3Rpb24gKCkgeyBzZXRUaW1lb3V0KGZ1bmN0aW9uICgpIHsgZm4oKSB9LCAxKTsgfSwgYWxsb3dEZWZhdWx0KTtcbn1cblxuZGVzY3JpYmUoXCJIVFRQXCIsIGZ1bmN0aW9uICgpIHtcblx0ZGVzY3JpYmUoXCJMaW5rc1wiLCBmdW5jdGlvbiAoKSB7XG5cdFx0dmFyIHNlcnZlciA9IGh0dHAuY3JlYXRlU2VydmVyKGZ1bmN0aW9uIChyZXEsIHJlcykgeyByZXMuZW5kKCk7IH0pLmxpc3RlbigpO1xuXHRcdGFmdGVyRWFjaChmdW5jdGlvbiAoKSB7IGRvY3VtZW50LmJvZHkuaW5uZXJIVE1MID0gXCJcIjsgfSk7XG5cdFx0YWZ0ZXIoZnVuY3Rpb24gKCkgeyBzZXJ2ZXIuY2xvc2UoKSB9KTtcblxuXHRcdGl0KFwic2hvdWxkIGhhbmRsZSBpbnRlcm5hbCBsaW5rc1wiLCBmdW5jdGlvbiAoZG9uZSkge1xuXHRcdFx0dmFyIHRlc3RVUkwgPSBcIi90ZXN0LVwiICsgdWlkKCk7XG5cdFx0XHR2YXIgZWwgICAgICA9IGNyZWF0ZUVsKFwiYVwiLCB7IGhyZWY6IHRlc3RVUkwgfSk7XG5cblx0XHRcdGFzc2VydC5vayhsb2NhdGlvbi5wYXRoICE9PSBlbC5ocmVmKTtcblxuXHRcdFx0YWZ0ZXJDbGljayhlbCwgZnVuY3Rpb24gKGUpIHtcblx0XHRcdFx0YXNzZXJ0Lm9rKGxvY2F0aW9uLmhyZWYgPT09IGVsLmhyZWYpO1xuXHRcdFx0XHRkb25lKCk7XG5cdFx0XHR9LCB0cnVlKTtcblxuXHRcdFx0Y2xpY2tFbChlbCk7XG5cdFx0fSk7XG5cblx0XHRpdChcInNob3VsZCBpZ25vcmUgZGVmYXVsdCBwcmV2ZW50ZWQgY2xpY2tzXCIsIGZ1bmN0aW9uIChkb25lKSB7XG5cdFx0XHR2YXIgdGVzdFVSTCA9IFwiL3Rlc3QtXCIgKyB1aWQoKTtcblx0XHRcdHZhciBlbCAgICAgID0gY3JlYXRlRWwoXCJhXCIsIHsgaHJlZjogdGVzdFVSTCB9KTtcblxuXHRcdFx0YXNzZXJ0Lm9rKGxvY2F0aW9uLnBhdGggIT09IGVsLmhyZWYpO1xuXG5cdFx0XHRvbkNsaWNrKGVsLCBmdW5jdGlvbiAoZSkgeyBlLnByZXZlbnREZWZhdWx0KCk7IH0pXG5cdFx0XHRhZnRlckNsaWNrKGVsLCBmdW5jdGlvbiAoZSkge1xuXHRcdFx0XHRhc3NlcnQub2sobG9jYXRpb24uaHJlZiAhPT0gZWwuaHJlZik7XG5cdFx0XHRcdGRvbmUoKTtcblx0XHRcdH0pO1xuXG5cdFx0XHRjbGlja0VsKGVsKTtcblx0XHR9KTtcblxuXHRcdGl0KFwic2hvdWxkIGlnbm9yZSBsaW5rcyB3aXRob3V0IGFuIGhyZWZcIiwgZnVuY3Rpb24gKGRvbmUpIHtcblx0XHRcdHZhciBlbCA9IGNyZWF0ZUVsKFwiYVwiLCB7fSk7XG5cblx0XHRcdG9uQ2xpY2soZWwsIGZ1bmN0aW9uIChlKSB7XG5cdFx0XHRcdGFzc2VydC5vayghZS5kZWZhdWx0UHJldmVudGVkKTtcblx0XHRcdFx0YXNzZXJ0Lm9rKGxvY2F0aW9uLmhyZWYgIT09IGVsLmhyZWYpO1xuXHRcdFx0XHRkb25lKCk7XG5cdFx0XHR9KTtcblxuXHRcdFx0Y2xpY2tFbChlbCk7XG5cdFx0fSk7XG5cblx0XHRpdChcInNob3VsZCBpZ25vcmUgcmVsIGV4dGVybmFsIGxpbmtzXCIsIGZ1bmN0aW9uIChkb25lKSB7XG5cdFx0XHR2YXIgZWwgPSBjcmVhdGVFbChcImFcIiwgeyBocmVmOiBcIi9cIiwgcmVsOiBcImV4dGVybmFsXCIgfSk7XG5cblx0XHRcdG9uQ2xpY2soZWwsIGZ1bmN0aW9uIChlKSB7XG5cdFx0XHRcdGFzc2VydC5vayghZS5kZWZhdWx0UHJldmVudGVkKTtcblx0XHRcdFx0YXNzZXJ0Lm9rKGxvY2F0aW9uLmhyZWYgIT09IGVsLmhyZWYpO1xuXHRcdFx0XHRkb25lKCk7XG5cdFx0XHR9KTtcblxuXHRcdFx0Y2xpY2tFbChlbCk7XG5cdFx0fSk7XG5cblx0XHRpdChcInNob3VsZCBpZ25vcmUgdGFyZ2V0IGxpbmtzXCIsIGZ1bmN0aW9uIChkb25lKSB7XG5cdFx0XHR2YXIgZWwgPSBjcmVhdGVFbChcImFcIiwgeyBocmVmOiBcIi9cIiwgdGFyZ2V0OiBcIl9ibGFua1wiIH0pO1xuXG5cdFx0XHRvbkNsaWNrKGVsLCBmdW5jdGlvbiAoZSkge1xuXHRcdFx0XHRhc3NlcnQub2soIWUuZGVmYXVsdFByZXZlbnRlZCk7XG5cdFx0XHRcdGFzc2VydC5vayhsb2NhdGlvbi5ocmVmICE9PSBlbC5ocmVmKTtcblx0XHRcdFx0ZG9uZSgpO1xuXHRcdFx0fSk7XG5cblx0XHRcdGNsaWNrRWwoZWwpO1xuXHRcdH0pO1xuXG5cdFx0aXQoXCJzaG91bGQgaWdub3JlIGRpZmZlcmVudCBwcm90b2NvbCBsaW5rc1wiLCBmdW5jdGlvbiAoZG9uZSkge1xuXHRcdFx0dmFyIGVsID0gY3JlYXRlRWwoXCJhXCIsIHsgaHJlZjogXCJodHRwczovL2xvY2FsaG9zdDo4MDAwL1wiIH0pO1xuXG5cdFx0XHRvbkNsaWNrKGVsLCBmdW5jdGlvbiAoZSkge1xuXHRcdFx0XHRhc3NlcnQub2soIWUuZGVmYXVsdFByZXZlbnRlZCk7XG5cdFx0XHRcdGFzc2VydC5vayhsb2NhdGlvbi5ocmVmICE9PSBlbC5ocmVmKTtcblx0XHRcdFx0ZG9uZSgpO1xuXHRcdFx0fSk7XG5cblx0XHRcdGNsaWNrRWwoZWwpO1xuXHRcdH0pO1xuXG5cdFx0aXQoXCJzaG91bGQgaWdub3JlIGxpbmtzIHdpdGggYSBkaWZmZXJlbnQgaG9zdFwiLCBmdW5jdGlvbiAoZG9uZSkge1xuXHRcdFx0dmFyIGVsID0gY3JlYXRlRWwoXCJhXCIsIHsgaHJlZjogXCJodHRwOi8vZ29vZ2xlLmNhXCIgfSk7XG5cblx0XHRcdGFzc2VydC5vayhsb2NhdGlvbi5wYXRoICE9PSBlbC5ocmVmKTtcblxuXHRcdFx0b25DbGljayhlbCwgZnVuY3Rpb24gKGUpIHtcblx0XHRcdFx0YXNzZXJ0Lm9rKCFlLmRlZmF1bHRQcmV2ZW50ZWQpO1xuXHRcdFx0XHRhc3NlcnQub2sobG9jYXRpb24uaHJlZiAhPT0gZWwuaHJlZik7XG5cdFx0XHRcdGRvbmUoKTtcblx0XHRcdH0pO1xuXG5cdFx0XHRjbGlja0VsKGVsKTtcblx0XHR9KTtcblx0fSk7XG5cblx0ZGVzY3JpYmUoXCJGb3Jtc1wiLCBmdW5jdGlvbiAoKSB7XG5cdFx0dmFyIGZvcm1EYXRhO1xuXHRcdHZhciBmb3JtUXVlcnk7XG5cdFx0dmFyIHNlcnZlciA9IGh0dHAuY3JlYXRlU2VydmVyKGZ1bmN0aW9uIChyZXEsIHJlcykge1xuXHRcdFx0Zm9ybURhdGEgPSByZXEuYm9keTtcblx0XHRcdGZvcm1VUkwgID0gcmVxLnVybDtcblx0XHRcdHJlcy5lbmQoKTtcblx0XHR9KS5saXN0ZW4oKTtcblx0XHRhZnRlckVhY2goZnVuY3Rpb24gKCkge1xuXHRcdFx0Zm9ybURhdGEgICAgICAgICAgICAgICAgPSBcblx0XHRcdGZvcm1VUkwgICAgICAgICAgICAgICAgID0gdW5kZWZpbmVkO1xuXHRcdFx0ZG9jdW1lbnQuYm9keS5pbm5lckhUTUwgPSBcIlwiO1xuXHRcdH0pO1xuXHRcdGFmdGVyKGZ1bmN0aW9uICgpIHsgc2VydmVyLmNsb3NlKCkgfSk7XG5cblx0XHRpdChcInNob3VsZCBoYW5kbGUgaW50ZXJuYWwgYm9keSBmb3Jtc1wiLCBmdW5jdGlvbiAoZG9uZSkge1xuXHRcdFx0dmFyIHRlc3RVUkwgPSBcIi90ZXN0LVwiICsgdWlkKCk7XG5cdFx0XHR2YXIgZWwgICAgICA9IGNyZWF0ZUVsKFwiZm9ybVwiLCB7IGFjdGlvbjogdGVzdFVSTCwgbWV0aG9kOiBcIlBPU1RcIiB9KTtcblx0XHRcdHZhciBpbnB1dCAgID0gY3JlYXRlRWwoXCJpbnB1dFwiLCB7IG5hbWU6IFwidGVzdFwiLCB2YWx1ZTogXCIxXCIgfSk7XG5cdFx0XHR2YXIgc3VibWl0ICA9IGNyZWF0ZUVsKFwiYnV0dG9uXCIsIHsgdHlwZTogXCJzdWJtaXRcIiB9KTtcblx0XHRcdGVsLmFwcGVuZENoaWxkKGlucHV0KTtcblx0XHRcdGVsLmFwcGVuZENoaWxkKHN1Ym1pdCk7XG5cblx0XHRcdGFmdGVyU3VibWl0KGVsLCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdGFzc2VydC5vayhmb3JtRGF0YS50ZXN0KTtcblx0XHRcdFx0ZG9uZSgpO1xuXHRcdFx0fSk7XG5cblx0XHRcdGNsaWNrRWwoc3VibWl0KTtcblx0XHR9KTtcblxuXHRcdGl0KFwic2hvdWxkIGhhbmRsZSBpbnRlcm5hbCBHRVQgZm9ybXMgd2l0aCBxdWVyeXN0cmluZ1wiLCBmdW5jdGlvbiAoZG9uZSkge1xuXHRcdFx0dmFyIHRlc3RVUkwgPSBcIi90ZXN0LVwiICsgdWlkKCk7XG5cdFx0XHR2YXIgZWwgICAgICA9IGNyZWF0ZUVsKFwiZm9ybVwiLCB7IGFjdGlvbjogdGVzdFVSTCwgbWV0aG9kOiBcIkdFVFwiIH0pO1xuXHRcdFx0dmFyIGlucHV0ICAgPSBjcmVhdGVFbChcImlucHV0XCIsIHsgbmFtZTogXCJ0ZXN0XCIsIHZhbHVlOiBcIjFcIiB9KTtcblx0XHRcdHZhciBzdWJtaXQgID0gY3JlYXRlRWwoXCJidXR0b25cIiwgeyB0eXBlOiBcInN1Ym1pdFwiIH0pO1xuXHRcdFx0ZWwuYXBwZW5kQ2hpbGQoaW5wdXQpO1xuXHRcdFx0ZWwuYXBwZW5kQ2hpbGQoc3VibWl0KTtcblxuXHRcdFx0YWZ0ZXJTdWJtaXQoZWwsIGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0YXNzZXJ0Lm9rKGZvcm1VUkwuaW5kZXhPZihKU09OLnN0cmluZ2lmeSh7IHRlc3Q6IFwiMVwiIH0pKSAhPT0gLTEpO1xuXHRcdFx0XHRkb25lKCk7XG5cdFx0XHR9KTtcblxuXHRcdFx0Y2xpY2tFbChzdWJtaXQpO1xuXHRcdH0pO1xuXG5cdFx0aXQoXCJzaG91bGQgaWdub3JlIGRlZmF1bHQgcHJldmVudGVkIGNsaWNrc1wiLCBmdW5jdGlvbiAoZG9uZSkge1xuXHRcdFx0dmFyIHRlc3RVUkwgPSBcIi90ZXN0LVwiICsgdWlkKCk7XG5cdFx0XHR2YXIgZWwgICAgICA9IGNyZWF0ZUVsKFwiZm9ybVwiLCB7IGFjdGlvbjogdGVzdFVSTCwgbWV0aG9kOiBcIlBPU1RcIiB9KTtcblx0XHRcdHZhciBpbnB1dCAgID0gY3JlYXRlRWwoXCJpbnB1dFwiLCB7IG5hbWU6IFwidGVzdFwiLCB2YWx1ZTogXCIxXCIgfSk7XG5cdFx0XHR2YXIgc3VibWl0ICA9IGNyZWF0ZUVsKFwiYnV0dG9uXCIsIHsgdHlwZTogXCJzdWJtaXRcIiB9KTtcblx0XHRcdGVsLmFwcGVuZENoaWxkKGlucHV0KTtcblx0XHRcdGVsLmFwcGVuZENoaWxkKHN1Ym1pdCk7XG5cblx0XHRcdG9uU3VibWl0KGVsLCBmdW5jdGlvbiAoZSkgeyBlLnByZXZlbnREZWZhdWx0KCk7IH0sIHRydWUpO1xuXHRcdFx0YWZ0ZXJTdWJtaXQoZWwsIGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0YXNzZXJ0LmVxdWFsKGZvcm1EYXRhLCB1bmRlZmluZWQpO1xuXHRcdFx0XHRkb25lKCk7XG5cdFx0XHR9KTtcblxuXHRcdFx0Y2xpY2tFbChzdWJtaXQpO1xuXHRcdH0pO1xuXG5cdFx0aXQoXCJzaG91bGQgaWdub3JlIGZvcm1zIHdpdGhvdXQgYW4gYWN0aW9uXCIsIGZ1bmN0aW9uIChkb25lKSB7XG5cdFx0XHR2YXIgZWwgICAgICA9IGNyZWF0ZUVsKFwiZm9ybVwiLCB7IG1ldGhvZDogXCJQT1NUXCIgfSk7XG5cdFx0XHR2YXIgaW5wdXQgICA9IGNyZWF0ZUVsKFwiaW5wdXRcIiwgeyBuYW1lOiBcInRlc3RcIiwgdmFsdWU6IFwiMVwiIH0pO1xuXHRcdFx0dmFyIHN1Ym1pdCAgPSBjcmVhdGVFbChcImJ1dHRvblwiLCB7IHR5cGU6IFwic3VibWl0XCIgfSk7XG5cdFx0XHRlbC5hcHBlbmRDaGlsZChpbnB1dCk7XG5cdFx0XHRlbC5hcHBlbmRDaGlsZChzdWJtaXQpO1xuXG5cdFx0XHRvblN1Ym1pdChlbCwgZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRhc3NlcnQuZXF1YWwoZm9ybURhdGEsIHVuZGVmaW5lZCk7XG5cdFx0XHRcdGRvbmUoKTtcblx0XHRcdH0pO1xuXG5cdFx0XHRjbGlja0VsKHN1Ym1pdCk7XG5cdFx0fSk7XG5cblx0XHRpdChcInNob3VsZCBpZ25vcmUgcmVsIGV4dGVybmFsIGZvcm1zXCIsIGZ1bmN0aW9uIChkb25lKSB7XG5cdFx0XHR2YXIgdGVzdFVSTCA9IFwiL3Rlc3QtXCIgKyB1aWQoKTtcblx0XHRcdHZhciBlbCAgICAgID0gY3JlYXRlRWwoXCJmb3JtXCIsIHsgYWN0aW9uOiB0ZXN0VVJMLCBtZXRob2Q6IFwiUE9TVFwiLCByZWw6IFwiZXh0ZXJuYWxcIiB9KTtcblx0XHRcdHZhciBpbnB1dCAgID0gY3JlYXRlRWwoXCJpbnB1dFwiLCB7IG5hbWU6IFwidGVzdFwiLCB2YWx1ZTogXCIxXCIgfSk7XG5cdFx0XHR2YXIgc3VibWl0ICA9IGNyZWF0ZUVsKFwiYnV0dG9uXCIsIHsgdHlwZTogXCJzdWJtaXRcIiB9KTtcblx0XHRcdGVsLmFwcGVuZENoaWxkKGlucHV0KTtcblx0XHRcdGVsLmFwcGVuZENoaWxkKHN1Ym1pdCk7XG5cblx0XHRcdGFmdGVyU3VibWl0KGVsLCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdGFzc2VydC5lcXVhbChmb3JtRGF0YSwgdW5kZWZpbmVkKTtcblx0XHRcdFx0ZG9uZSgpO1xuXHRcdFx0fSk7XG5cblx0XHRcdGNsaWNrRWwoc3VibWl0KTtcblx0XHR9KTtcblxuXHRcdGl0KFwic2hvdWxkIGlnbm9yZSB0YXJnZXQgZm9ybXNcIiwgZnVuY3Rpb24gKGRvbmUpIHtcblx0XHRcdHZhciB0ZXN0VVJMID0gXCIvdGVzdC1cIiArIHVpZCgpO1xuXHRcdFx0dmFyIGVsICAgICAgPSBjcmVhdGVFbChcImZvcm1cIiwgeyBhY3Rpb246IHRlc3RVUkwsIG1ldGhvZDogXCJQT1NUXCIsIHRhcmdldDogXCJfYmxhbmtcIiB9KTtcblx0XHRcdHZhciBpbnB1dCAgID0gY3JlYXRlRWwoXCJpbnB1dFwiLCB7IG5hbWU6IFwidGVzdFwiLCB2YWx1ZTogXCIxXCIgfSk7XG5cdFx0XHR2YXIgc3VibWl0ICA9IGNyZWF0ZUVsKFwiYnV0dG9uXCIsIHsgdHlwZTogXCJzdWJtaXRcIiB9KTtcblx0XHRcdGVsLmFwcGVuZENoaWxkKGlucHV0KTtcblx0XHRcdGVsLmFwcGVuZENoaWxkKHN1Ym1pdCk7XG5cblx0XHRcdGFmdGVyU3VibWl0KGVsLCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdGFzc2VydC5lcXVhbChmb3JtRGF0YSwgdW5kZWZpbmVkKTtcblx0XHRcdFx0ZG9uZSgpO1xuXHRcdFx0fSk7XG5cblx0XHRcdGNsaWNrRWwoc3VibWl0KTtcblx0XHR9KTtcblxuXHRcdGl0KFwic2hvdWxkIGlnbm9yZSBkaWZmZXJlbnQgcHJvdG9jb2wgZm9ybXNcIiwgZnVuY3Rpb24gKGRvbmUpIHtcblx0XHRcdHZhciBlbCAgICAgID0gY3JlYXRlRWwoXCJmb3JtXCIsIHsgYWN0aW9uOiBcImh0dHBzOi8vbG9jYWxob3N0OjgwMDAvXCIsIG1ldGhvZDogXCJQT1NUXCIgfSk7XG5cdFx0XHR2YXIgaW5wdXQgICA9IGNyZWF0ZUVsKFwiaW5wdXRcIiwgeyBuYW1lOiBcInRlc3RcIiwgdmFsdWU6IFwiMVwiIH0pO1xuXHRcdFx0dmFyIHN1Ym1pdCAgPSBjcmVhdGVFbChcImJ1dHRvblwiLCB7IHR5cGU6IFwic3VibWl0XCIgfSk7XG5cdFx0XHRlbC5hcHBlbmRDaGlsZChpbnB1dCk7XG5cdFx0XHRlbC5hcHBlbmRDaGlsZChzdWJtaXQpO1xuXG5cdFx0XHRhZnRlclN1Ym1pdChlbCwgZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRhc3NlcnQuZXF1YWwoZm9ybURhdGEsIHVuZGVmaW5lZCk7XG5cdFx0XHRcdGRvbmUoKTtcblx0XHRcdH0pO1xuXG5cdFx0XHRjbGlja0VsKHN1Ym1pdCk7XG5cdFx0fSk7XG5cblx0XHRpdChcInNob3VsZCBpZ25vcmUgbGlua3Mgd2l0aCBhIGRpZmZlcmVudCBob3N0XCIsIGZ1bmN0aW9uIChkb25lKSB7XG5cdFx0XHR2YXIgZWwgICAgICA9IGNyZWF0ZUVsKFwiZm9ybVwiLCB7IGFjdGlvbjogXCJodHRwOi8vZ29vZ2xlLmNhXCIsIG1ldGhvZDogXCJQT1NUXCIgfSk7XG5cdFx0XHR2YXIgaW5wdXQgICA9IGNyZWF0ZUVsKFwiaW5wdXRcIiwgeyBuYW1lOiBcInRlc3RcIiwgdmFsdWU6IFwiMVwiIH0pO1xuXHRcdFx0dmFyIHN1Ym1pdCAgPSBjcmVhdGVFbChcImJ1dHRvblwiLCB7IHR5cGU6IFwic3VibWl0XCIgfSk7XG5cdFx0XHRlbC5hcHBlbmRDaGlsZChpbnB1dCk7XG5cdFx0XHRlbC5hcHBlbmRDaGlsZChzdWJtaXQpO1xuXG5cdFx0XHRhZnRlclN1Ym1pdChlbCwgZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRhc3NlcnQuZXF1YWwoZm9ybURhdGEsIHVuZGVmaW5lZCk7XG5cdFx0XHRcdGRvbmUoKTtcblx0XHRcdH0pO1xuXG5cdFx0XHRjbGlja0VsKHN1Ym1pdCk7XG5cdFx0fSk7XG5cdH0pO1xufSk7Il19
