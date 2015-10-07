var Server          = require("./server");
var IncomingMessage = require("./request.js");
var ServerResponse  = require("./response.js");
var STATUS_CODES    = require("./constants/status-codes.json")
var METHODS         = require("./constants/methods.json")

module.exports = {
	STATUS_CODES: STATUS_CODES,
	METHODS: METHODS,
	Server: Server,
	IncomingMessage: IncomingMessage,
	ServerResponse: ServerResponse,
	createServer: function createServer (handler) {
		return new Server(handler);
	}
};