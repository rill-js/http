var Server = require("./server");

module.exports = {
	Server: Server,
	createServer: function createServer (handler) {
		return new Server(handler);
	}
};