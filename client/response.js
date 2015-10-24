var EventEmitter = require("events").EventEmitter;
var STATUS_CODES = require("./constants/status-codes.json");
var noop         = function () {};

function ServerResponse (opts) {
	this._headers  = {};
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
proto.writeContinue = 
proto.setTimeout    =
proto.addTrailers   = noop;

/**
 * Write status, status message and headers the same as node js.
 */
proto.writeHead = function writeHead (statusCode, statusMessage, headers) {
	if (this.finished) {
		throw new Error("Response has already been sent.");
	}

	this.statusCode = statusCode;
	if (statusMessage) {
		if (typeof statusMessage === "object") {
			headers = statusMessage;
		} else {
			this.statusMessage = statusMessage;
		}
	}

	if (typeof headers === "object") {
		for (var key in headers) {
			this.setHeader(key, headers[key]);
		}
	}
};

/**
 * Get a header the same as node js.
 */
proto.getHeader = function getHeader (header) {
	return this._headers[header.toLowerCase()];
};

/**
 * Remove a header the same as node js.
 */
proto.removeHeader = function removeHeader (header) {
	delete this._headers[header.toLowerCase()];
};

/**
 * Write a header the same as node js.
 */
proto.setHeader = function setHeader (header, value) {
	this._headers[header.toLowerCase()] = value;
};

/**
 * Handle event ending the same as node js.
 */
proto.end = function end () {
	if (this.finished) {
		throw new Error("Response has already been sent.");
	}

	if (this.statusMessage == null) {
		this.statusMessage = STATUS_CODES[this.statusCode];
	}

	if (this.sendDate) {
		this._headers["date"]   = (new Date()).toUTCString();
	}

	this._headers["status"] = this.statusCode;
	this.headersSent        = true;
	this.finished           = true;
	this.emit("finish");
};

module.exports = ServerResponse;