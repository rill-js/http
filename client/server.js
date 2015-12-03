"use strict";

var URL          = require("url");
var EventEmitter = require("events").EventEmitter;
var handlers     = require("./handlers")
var Request      = require("./request.js");
var Response     = require("./response.js");
var location     = window.history.location || window.location;

/**
 * Emulates node js http server in the browser.
 *
 * @param {Function} handle - the handle for a request.
 */
function Server (handler) {
	this._handle          = this;
	this._started         = false;
	this._pending_refresh = null;
	if (handler) {
		if (typeof handler !== "function") {
			throw new TypeError("listener must be a function");
		}
		this.on("request", handler);
	}
}
var proto = Server.prototype = Object.create(EventEmitter.prototype);

/**
 * Listen to all url change events on a dom element and trigger the server callback.
 */
proto.listen = function listen () {
	var cb            = arguments[arguments.length - 1];
	this._onURLChange = handlers.onURLChange.bind(this);
	this._onSubmit    = handlers.onSubmit.bind(this);
	this._onClick     = handlers.onClick.bind(this);

	window.addEventListener("DOMContentLoaded", this._onURLChange);
	window.addEventListener("popstate", this._onURLChange);
	window.addEventListener("submit", this._onSubmit);
	window.addEventListener("click", this._onClick);

	if (typeof cb === "function") setTimeout(cb, 0);
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

	if (typeof cb === "function") setTimeout(cb, 0);
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
proto.navigate = function navigate (req, replaceState) {
	// Allow navigation with url only.
	if (typeof req === "string") req = { url: req };

	// Ignore links that don't share a protocol or host with the browsers.
	var parsed = URL.parse(URL.resolve(location.href, req.url));
	if (parsed.host !== location.host) return false;
	if (parsed.protocol !== location.protocol) return false;

	req.url = parsed.path + (parsed.hash || "");
	var req = new Request(req);
	var res = new Response();

	res.once("finish", function onEnd() {
		req.complete = true;
		req.emit("end");

		clearTimeout(this._pending_refresh);

		// Check if we should set some cookies.
		if (res.getHeader("set-cookie")) {
			var cookies = res.getHeader("set-cookie");
			if (cookies.constructor !== Array) cookies = [cookies];
			cookies.forEach(function (cookie) { document.cookie = cookie; });
		}

		// Check to see if a refresh was requested.
		if (res.getHeader("refresh")) {
			var parts       = res.getHeader("refresh").split("; url=");
			var timeout     = parseInt(parts[0]) * 1000;
			var redirectURL = parts[1];
			// This handles refresh headers similar to browsers.
			this._pending_refresh = setTimeout(
				this.navigate.bind(this, redirectURL, true),
				timeout
			);
		}

		// Check to see if we should redirect.
		if (res.getHeader("location")) {
			setTimeout(this.navigate.bind(this, res.getHeader("location"), true), 0);
			return;
		}

		// Check to see if we should update the url.
		if (req.method !== "GET") return;

		/*
		 * When navigating a user will be brought to the top of the page.
		 * If the urls contains a hash that is the id of an element (a target) then the target will be scrolled to.
		 * This is similar to how browsers handle page transitions natively.
		 */
		var hash = req.url.match(/#(.+)$/);

		if (hash != null) {
			target = document.getElementById(hash[1]);
			if (target) {
				target.scrollIntoView({
					block: "start",
					behavior: "smooth"
				});
			}
		} else if (this._started) {
			window.scrollTo(0, 0);
		}

		// Started allows for the browser to handle the initial scroll position.
		this._started = true;

		// Update the href in the browser.
		history[replaceState
			? "replaceState"
			: "pushState"
		](null, "", req.url);
	}.bind(this));

	this.emit("request", req, res);
	return this;
};

module.exports = Server;
