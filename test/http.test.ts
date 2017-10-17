import * as assert from "assert";
import * as http from "../src/client";

describe("HTTP", () => {
  describe("#createServer", () => {
    it("should create a server", () => {
      assert.equal(
        typeof http.createServer().on,
        "function",
        "should be an event emitter."
      );
      assert.equal(
        typeof http.createServer().listen,
        "function",
        "should be a node style server."
      );
    });
  });
});
