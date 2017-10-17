import * as assert from "assert";
import { Buffer } from "buffer";
import * as http from "../src/client";
import { _createServerResponse } from "../src/client/server-response";

/**
 * Creates an empty server response.
 */
function createServerResponse() {
  const incomingMessage = new http.IncomingMessage({} as any);
  return _createServerResponse(incomingMessage);
}

describe("Response", () => {
  it("should not need options", () => {
    const res = createServerResponse();
    assert.ok(res, "should have created response");
  });

  describe("#writeContinue, #setTimeout, #addTrailers", () => {
    it("should all be noops", () => {
      const res = createServerResponse();
      res.writeContinue();
      res.setTimeout();
      res.addTrailers();
    });
  });

  describe("#setHeader, #hasHeader, #getHeader, #getHeaders, #getHeaderNames", () => {
    it("should set and get a header", () => {
      const res = createServerResponse();
      res.setHeader("X-Custom-Header", "abc");
      assert.ok(res.hasHeader("X-Custom-Header"), "should have set header");
      assert.equal(
        res.getHeader("X-Custom-Header"),
        "abc",
        "should have set header"
      );
      assert.deepEqual(res.getHeaders(), { "x-custom-header": "abc" });
    });

    it("should be case insensitive", () => {
      const res = createServerResponse();
      res.setHeader("HEADER-CAPS", "abc");
      assert.equal(
        res.getHeader("header-caps"),
        "abc",
        "should have set header"
      );

      res.setHeader("header-lower", "abc");
      assert.equal(
        res.getHeader("HEADER-LOWER"),
        "abc",
        "should have set header"
      );
      assert.deepEqual(res.getHeaders(), {
        "header-caps": "abc",
        "header-lower": "abc"
      });
      assert.deepEqual(res.getHeaderNames(), ["header-caps", "header-lower"]);
    });
  });

  describe("#removeHeader", () => {
    it("should unset a header", () => {
      const res = createServerResponse();
      res.setHeader("X-Custom-Header", "abc");
      res.removeHeader("X-Custom-Header");
      assert.equal(
        res.getHeader("X-Custom-Header"),
        null,
        "should have removed the header"
      );
    });
  });

  describe("#writeHead", () => {
    it("should set status", () => {
      const res = createServerResponse();
      res.writeHead(200);

      assert.ok(res.headersSent, "should have sent headers");
      assert.equal(res.statusCode, 200, "should have set statusCode");
    });

    it("should set headers and status", () => {
      const res = createServerResponse();
      res.writeHead(200, "success", {
        "X-Custom-Header": "hello"
      });

      assert.ok(res.headersSent, "should have sent headers");
      assert.equal(
        res.getHeader("X-Custom-Header"),
        "hello",
        "should have set header"
      );
      assert.equal(res.statusCode, 200, "should have set statusCode");
      assert.equal(
        res.statusMessage,
        "success",
        "should have set statusMessage"
      );
    });

    it("should have optional status message", () => {
      const res = createServerResponse();
      res.writeHead(200, {
        "X-Custom-Header": "hello"
      });

      assert.ok(res.headersSent, "should have sent headers");
      assert.equal(
        res.getHeader("X-Custom-Header"),
        "hello",
        "should have set header"
      );
      assert.equal(res.statusCode, 200, "should have set statusCode");
    });

    it("should do nothing if the request is already finished", done => {
      const res = createServerResponse();
      res.writeHead(200, "success", {
        "X-Custom-Header": "hello"
      });

      res.end(() => {
        res.writeHead(201, "created", {
          "X-Custom-Header": "world"
        });
        assert.ok(res.headersSent, "should have sent headers");
        assert.equal(
          res.getHeader("X-Custom-Header"),
          "hello",
          "should have set header"
        );
        assert.equal(res.statusCode, 200, "should have set statusCode");
        assert.equal(
          res.statusMessage,
          "success",
          "should have set statusMessage"
        );
        done();
      });
    });
  });

  describe("#write", () => {
    it("should accept a buffer", () => {
      const res = createServerResponse();
      res.write(Buffer.from(["abc"]));
      assert.equal(res._body.length, 1, "should have written to the body");
    });

    it("should accept a callback", done => {
      const res = createServerResponse();
      res.write(Buffer.from([""]), done);
      res.end();
    });
  });

  describe("#end", () => {
    it("should accept a buffer", () => {
      const res = createServerResponse();
      res.write(Buffer.from(["abc"]));
      assert.equal(res._body.length, 1, "should have written to the body");
      res.end(Buffer.from(["efd"]));
      assert.equal(res._body.length, 2, "should have written to the body");
    });

    it("should finish a response", done => {
      const res = createServerResponse();
      let called = 0;
      res.once("finish", checkCompleted);
      res.end(checkCompleted);

      function checkCompleted() {
        assert.ok(res.headersSent, "should have sent headers");
        assert.ok(res.finished, "should be finished");
        called++;
        if (called === 2) {
          done();
        }
      }
    });

    it("should finish a response and accept a buffer", done => {
      const res = createServerResponse();
      res.end(Buffer.from(["abc"]), checkCompleted);

      function checkCompleted() {
        assert.ok(res.headersSent, "should have sent headers");
        assert.ok(res.finished, "should be finished");
        assert.equal(res._body.length, 1, "should have written to the body");
        done();
      }
    });

    it("should do nothing if response already finished", done => {
      const res = createServerResponse();
      let called = 0;
      res.end(checkCompleted);
      res.end(checkCompleted);

      function checkCompleted() {
        assert.ok(res.headersSent, "should have sent headers");
        assert.ok(res.finished, "should be finished");
        called++;
        if (called === 1) {
          done();
        }
      }
    });
  });

  describe("#sendDate", () => {
    it("should send date header by default", () => {
      const res = createServerResponse();
      res.end();
      assert.ok(res.getHeader("date"), "should have set date header.");
    });

    it("should be able to disable date header", () => {
      const res = createServerResponse();
      res.sendDate = false;
      res.end();
      assert.ok(!res.getHeader("date"), "should have set date header.");
    });
  });
});
