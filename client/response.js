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