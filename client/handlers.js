"use strict";

var URL       = require("url");
var parseForm = require("parse-form");
var location  = window.history.location || window.location;
var reg       = { rel: /(?:^|\s+)external(?:\s+|$)/ };

module.exports = {
	onPopState: onPopState,
	onSubmit:   onSubmit,
	onClick:    onClick
};

/*
 * Handle an a pop state (back) event.
 *
 * @param {Object} e
 */
function onPopState (e) {
	this.navigate(location.href, { popState: true });
};

/*
 * Handle intercepting forms to update the url.
 *
 * @param {Object} e
 */
function onSubmit (e) {
	// Ignore canceled events.
	if (e.defaultPrevented) return;

	// Get the <form> element.
	var el        = e.target;
	var submitted = false;

	// Ignore clicks from linkless elements
	if (!el.action) return;

	// Ignore the click if the element has a target.
	if (el.target && el.target !== "_self") return;
	// Ignore 'rel="external"' links.
	if (el.hasAttribute("rel") && reg.rel.test(el.getAttribute("rel"))) return;

	var method = (el.getAttribute("method") || el.method).toUpperCase();
	var data = parseForm(el, method === "GET");

	if (method === "GET") {
		// On a get request a forms body is converted into a query string.
		var parsed = URL.parse(URL.resolve(location.href, el.action));
		// We delete the search part so that a query object can be used.
		delete parsed.search;
		parsed.query = data.body;
		submitted    = this.navigate(URL.format(parsed));
	} else {
		submitted = this.navigate({
			url:     el.action,
			method:  method,
			body:    data.body,
			files:   data.files,
			headers: { "content-type": el.enctype }
		});
	}

	if (!el.hasAttribute("data-noreset")) el.reset();
	if (submitted) e.preventDefault();
};

/*
 * Handle intercepting link clicks to update the url.
 *
 * @param {Object} e
 */
function onClick (e) {
	// Ignore canceled events, modified clicks, and right clicks.
	if (
		e.defaultPrevented ||
		e.metaKey          ||
		e.ctrlKey          ||
		e.shiftKey         ||
		e.button           !== 0
	) return;

	// Get the <a> element.
	var el = e.target;
	while (el != null && el.nodeName !== "A") el = el.parentNode;

	// Ignore if we couldn't find a link.
	if (!el) return;

	// Ignore clicks from linkless elements
	if (!el.href) return;
	// Ignore downloadable links.
	if (el.download) return;
	// Ignore the click if the element has a target.
	if (el.target && el.target !== "_self") return;
	// Ignore 'rel="external"' links.
	if (el.rel && reg.rel.test(el.rel)) return;

	// Attempt to navigate internally.
	if (this.navigate(el.href)) e.preventDefault();
};
