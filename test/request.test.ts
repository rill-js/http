import * as assert from "assert";
import { get as getLocation } from "get-loc";
import { get as getWindow } from "get-win";
import * as URL from "url";
import { _createIncomingMessage } from "../src/client/incoming-message";

const window = getWindow();
const location = getLocation();

/**
 * Creates an empty incoming message.
 */
function createIncomingMessage(opts) {
  opts.parsed = URL.parse(URL.resolve(location.href, opts.url));
  const incomingMessage = _createIncomingMessage({} as any, opts);
  incomingMessage.url = opts.url;
  return incomingMessage;
}

describe("Request", () => {
  it("should populate fields", () => {
    const opts = {
      body: { hello: "world" },
      method: "POST",
      url: "/"
    };
    const req = createIncomingMessage(opts);
    assert.equal(req.url, opts.url, "should have url");
    assert.equal(req.method, opts.method, "should have method");
    assert.deepEqual(req._options.body, opts.body, "should have body");
    assert.ok(req.connection, "should have connection");
    assert.ok(req.socket, "should have socket");
  });

  it("should default method to GET", () => {
    const opts = {
      url: "/"
    };
    const req = createIncomingMessage(opts);
    assert.equal(req.url, opts.url, "should have url");
    assert.equal(req.method, "GET", "should have method");
  });
});
