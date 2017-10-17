import * as assert from "assert";
import * as http from "../src/client";

describe("Server", () => {
  describe("#listen", () => {
    it("should be able to listen and emit events", done => {
      let called = 0;
      const server = new http.Server();
      server.once("listening", checkCompleted);
      server.listen(checkCompleted);
      function checkCompleted() {
        assert(server.listening, "server should be listening");
        called++;
        if (called === 2) {
          done();
        }
      }
    });

    it("should not need listener function", done => {
      let called = 0;
      const server = new http.Server();
      server.once("listening", checkCompleted);
      server.listen();
      function checkCompleted() {
        assert(server.listening, "server should be listening");
        called++;
        if (called === 1) {
          done();
        }
      }
    });
  });

  describe("#close", () => {
    it("should be able to close and emit events", done => {
      let called = 0;
      const server = new http.Server();
      server.once("close", checkCompleted);
      server.close(checkCompleted);
      function checkCompleted() {
        assert(!server.listening, "server should not be listening");
        called++;
        if (called === 2) {
          done();
        }
      }
    });

    it("should have closing function be optional", done => {
      const server = new http.Server();
      server.once("close", checkCompleted);
      server.close();
      function checkCompleted() {
        assert(!server.listening, "server should not be listening");
        done();
      }
    });
  });

  describe("#unref", () => {
    it("should return itself", () => {
      const server = new http.Server();
      assert.equal(server.unref(), server);
    });
  });

  describe("#address", () => {
    it("should return nothing", () => {
      const server = new http.Server();
      assert.equal(server.address(), undefined);
    });
  });
});
