var EventEmitter = require("events").EventEmitter;
var referrer     = document.referrer;

function Request (opts) {
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
var proto = Request.prototype = Object.create(EventEmitter.prototype);

module.exports = Request;