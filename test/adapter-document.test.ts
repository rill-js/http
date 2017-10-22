import "es6-promise/auto";
import "isomorphic-fetch";

import * as assert from "assert";
import { get as getLocation } from "get-loc";
import { get as getWindow } from "get-win";
import * as URL from "url";

import * as http from "../src/client";
import { attach, fetch } from "../src/client/adapter/document";

const window = getWindow();
const location = getLocation();
const { Request } = global as any;
const { history } = window;
const diffProtocol = location.protocol === "https:" ? "http" : "https";

// Patch jsdom.
if (window !== global) {
  // tslint:disable-next-line
  window.scrollTo = () => {};
  window.Headers = (global as any).Headers;
  window.Request = (global as any).Request;
  window.Response = (global as any).Response;
}

describe("Adapter/Browser", () => {
  const originalHref = location.href;
  after(() => {
    // Reset href on each test.
    if (location.href !== originalHref) {
      history.replaceState(null, "", originalHref);
    }
  });

  describe("cookies", () => {
    const server = attach(http.createServer(), false);
    before(done => {
      server.listen(done);
    });
    after(done => {
      server.close(done);
    });

    it("should set a single cookie", () => {
      const setCookie = "x=" + String(new Date());
      server.once("request", (req, res) => {
        res.setHeader("set-cookie", setCookie);
        res.end();
      });

      return fetch(server, "/test", {
        history: false,
        method: "POST"
      }).then(() => {
        assert.ok(
          document.cookie.indexOf(setCookie) !== -1,
          "should have set cookie"
        );
      });
    });

    it("should set a multiple cookies", () => {
      const setCookieA = "x=" + String(new Date());
      const setCookieB = "x=" + String(new Date());
      server.once("request", (req, res) => {
        res.setHeader("set-cookie", [setCookieA, setCookieB]);
        res.end();
      });

      return fetch(server, "/test", {
        history: false,
        method: "POST"
      }).then(() => {
        assert.ok(
          document.cookie.indexOf(setCookieA) !== -1,
          "should have set cookie"
        );
        assert.ok(
          document.cookie.indexOf(setCookieB) !== -1,
          "should have set cookie"
        );
      });
    });
  });

  describe("initialize", () => {
    const server = attach(http.createServer());
    before(() => {
      server.listen();
    });
    after(done => {
      server.close(done);
    });

    it("should trigger a request on load", done => {
      server.once("request", () => done());
    });
  });

  describe("refresh", () => {
    const server = attach(http.createServer(), false);
    before(done => {
      server.listen(done);
    });
    after(done => {
      server.close(done);
    });

    it("should trigger a fake browser refresh on refresh links", done => {
      let start;
      server.once("request", handleNavigate);
      fetch(server, "/test", { history: false });

      function handleNavigate(req, res) {
        start = new Date();
        assert.equal(req.url, "/test", "should have navigated");
        server.once("request", handleRedirect);
        res.writeHead(302, { refresh: "1; url=/redirected" });
        res.end();
      }

      function handleRedirect(req, res) {
        const delta = Number(new Date()) - start;
        assert.ok(delta >= 700, "should be 1000ms later");
        assert.ok(delta < 2500, "should be 1000ms later");
        assert.equal(req.url, "/redirected", "should have redirected");
        res.end(done);
      }
    });
  });

  describe("back", () => {
    const server = attach(http.createServer(), false);
    before(done => {
      server.listen(done);
    });
    after(done => {
      server.close(done);
    });

    it("should handle popstate", done => {
      server.once("request", (req, res) => {
        assert.equal(
          req.url,
          location.pathname,
          "should have triggered back button"
        );
        done();
      });

      history.pushState(null, "", "/new-page");
      history.back();
    });
  });

  describe("<a> click", () => {
    const server = attach(
      http.createServer((req, res) => {
        res.end();
      }),
      false
    );
    before(done => {
      server.listen(done);
    });
    after(done => {
      server.close(done);
    });

    it("should handle internal links", done => {
      const testURL = "/test-internal-link";
      const el = createEl("a", { href: testURL });

      once("click", el, e => {
        assert.ok(e.defaultPrevented);
        el.parentNode.removeChild(el);
        done();
      });

      clickEl(el);
    });

    it("should handle internal links with new paths and hashes", done => {
      const testURL = "/test-internal-hash-link#test";
      const el = createEl("a", { href: testURL });

      once("click", el, e => {
        assert.ok(e.defaultPrevented);
        el.parentNode.removeChild(el);
        done();
      });

      clickEl(el);
    });

    it("should ignore internal links with only a hash change", done => {
      const testURL = "#test";
      const el = createEl("a", { href: testURL });

      once("click", el, e => {
        assert.ok(!e.defaultPrevented);
        el.parentNode.removeChild(el);
        done();
      });

      clickEl(el);
    });

    it("should handle internal links (child element)", done => {
      const testURL = "/test-internal-link";
      const el = createEl("a", { href: testURL });
      const span = document.createElement("span");
      el.appendChild(span);

      once("click", span, e => {
        assert.ok(e.defaultPrevented);
        el.parentNode.removeChild(el);
        done();
      });

      clickEl(span);
    });

    it("should ignore non links", done => {
      const el = createEl("span");

      once("click", el, e => {
        assert.ok(!e.defaultPrevented);
        el.parentNode.removeChild(el);
        done();
      });

      clickEl(el);
    });

    it("should ignore default prevented clicks", done => {
      const testURL = "/test-default-prevented-link";
      const el = createEl("a", { href: testURL });

      el.addEventListener("click", e => {
        e.preventDefault();
      });
      once("click", el, e => {
        assert.ok(e.defaultPrevented);
        el.parentNode.removeChild(el);
        done();
      });

      clickEl(el);
    });

    if (!(history as any).emulate) {
      it("should ignore links without an href", done => {
        const el = createEl("a");

        once("click", el, e => {
          assert.ok(!e.defaultPrevented);
          done();
        });

        clickEl(el);
      });
    }

    it("should ignore rel external links", done => {
      const el = createEl("a", { href: "/", rel: "external" });

      once("click", el, e => {
        assert.ok(!e.defaultPrevented);
        el.parentNode.removeChild(el);
        done();
      });

      clickEl(el);
    });

    it("should ignore target links", done => {
      const el = createEl("a", { href: "/", target: "_blank" });

      once("click", el, e => {
        assert.ok(!e.defaultPrevented);
        el.parentNode.removeChild(el);
        done();
      });

      clickEl(el);
    });

    it("should ignore different protocol links", done => {
      const el = createEl("a", {
        href: diffProtocol + "://" + location.host + "/test"
      });

      once("click", el, e => {
        assert.ok(!e.defaultPrevented);
        el.parentNode.removeChild(el);
        done();
      });

      clickEl(el);
    });

    it("should ignore links with a different host", done => {
      const el = createEl("a", { href: "http://google.ca" });

      once("click", el, e => {
        assert.ok(!e.defaultPrevented);
        el.parentNode.removeChild(el);
        done();
      });

      clickEl(el);
    });

    it("should ignore links with a download attribute", done => {
      const el = createEl("a", { href: "/test", download: "test.file" });

      once("click", el, e => {
        assert.ok(!e.defaultPrevented);
        el.parentNode.removeChild(el);
        done();
      });

      clickEl(el);
    });
  });

  describe("<form> submit", () => {
    let formData;
    let formURL;
    let server;

    beforeEach(done => {
      server = attach(
        http.createServer((req, res) => {
          formData = req._options.body;
          formURL = req.url;
          res.end();
        }),
        false
      ).listen(done);
    });
    afterEach(done => {
      formData = formURL = undefined;
      server.close(done);
    });

    it("should handle internal body forms", done => {
      const testURL = "/test-internal-post-form";
      const el = createEl("form", { action: testURL, method: "POST" });
      const input = createEl("input", { name: "test", value: "1" });
      const submit = createEl("button", { type: "submit" });
      el.appendChild(input);
      el.appendChild(submit);

      once("submit", el, e => {
        assert.ok(e.defaultPrevented);
        setTimeout(() => {
          assert.ok(formData.test);
          el.parentNode.removeChild(el);
          done();
        }, 16);
      });

      clickEl(submit);
    });

    it("should handle internal GET forms with querystring", done => {
      const testURL = "/test-internal-get-form";
      const el = createEl("form", { action: testURL, method: "GET" });
      const input = createEl("input", { name: "test", value: "1" });
      const submit = createEl("button", { type: "submit" });
      el.appendChild(input);
      el.appendChild(submit);

      once("submit", el, e => {
        assert.ok(e.defaultPrevented);
        setTimeout(() => {
          const query = URL.parse(formURL, true).query;
          assert.equal(query.test, 1);
          el.parentNode.removeChild(el);
          done();
        }, 16);
      });

      clickEl(submit);
    });

    it("should ignore default prevented submits", done => {
      const testURL = "/test-default-prevented-form";
      const el = createEl("form", { action: testURL, method: "POST" });
      const input = createEl("input", { name: "test", value: "1" });
      const submit = createEl("button", { type: "submit" });
      el.appendChild(input);
      el.appendChild(submit);

      el.addEventListener("submit", e => {
        e.preventDefault();
      });
      once("submit", el, e => {
        assert.ok(e.defaultPrevented);
        setTimeout(() => {
          assert.equal(formData, undefined);
          el.parentNode.removeChild(el);
          done();
        }, 16);
      });

      clickEl(submit);
    });

    it("should ignore target forms", done => {
      const testURL = "/test-invalid-target-form";
      const el = createEl("form", {
        action: testURL,
        method: "POST",
        target: "_blank"
      });
      const input = createEl("input", { name: "test", value: "1" });
      const submit = createEl("button", { type: "submit" });
      el.appendChild(input);
      el.appendChild(submit);

      once("submit", el, e => {
        assert.ok(!e.defaultPrevented);
        setTimeout(() => {
          assert.equal(formData, undefined);
          el.parentNode.removeChild(el);
          done();
        }, 16);
      });

      clickEl(submit);
    });

    it("should ignore different protocol forms", done => {
      const el = createEl("form", {
        action: diffProtocol + "://" + location.host + "/test",
        method: "POST"
      });
      const input = createEl("input", { name: "test", value: "1" });
      const submit = createEl("button", { type: "submit" });
      el.appendChild(input);
      el.appendChild(submit);

      once("submit", el, e => {
        assert.ok(!e.defaultPrevented);
        setTimeout(() => {
          assert.equal(formData, undefined);
          el.parentNode.removeChild(el);
          done();
        }, 16);
      });

      clickEl(submit);
    });

    it("should ignore forms with a different host", done => {
      const el = createEl("form", {
        action: "http://google.ca",
        method: "POST"
      });
      const input = createEl("input", { name: "test", value: "1" });
      const submit = createEl("button", { type: "submit" });
      el.appendChild(input);
      el.appendChild(submit);

      once("submit", el, e => {
        assert.ok(!e.defaultPrevented);
        setTimeout(() => {
          assert.equal(formData, undefined);
          el.parentNode.removeChild(el);
          done();
        }, 16);
      });

      clickEl(submit);
    });
  });

  describe("#fetch", () => {
    it("should fail with invalid options", done => {
      const server = new http.Server();
      fetch(server, 1 as any).catch(err => {
        assert.equal(err.name, "TypeError");
        fetch(server, {}).catch(err2 => {
          assert.equal(err2.name, "TypeError");
          done();
        });
      });
    });

    it("should emit a new request", done => {
      let called = 0;
      const server = new http.Server(checkCompleted);
      server.once("request", checkCompleted);
      server.listen(() => {
        fetch(server, "/test", { history: false });
      });

      function checkCompleted(req, res) {
        assert.ok(server.listening, "server should be listening");
        assert.ok(
          req instanceof http.IncomingMessage,
          "should have IncomingMessage"
        );
        assert.ok(
          res instanceof http.ServerResponse,
          "should have ServerResponse"
        );
        called++;
        if (called === 2) {
          server.close(done);
        }
      }
    });

    it("should pass through body option", done => {
      let startup = true;
      const server = new http.Server(checkCompleted);
      server.once("request", checkCompleted);
      server.listen(() => {
        fetch(server, "/test", { method: "POST", body: { a: 1 } });
      });

      function checkCompleted(req, res) {
        if (startup) {
          startup = false;
          return;
        }

        assert.deepEqual(
          req._options.body,
          { a: 1 },
          "should have passed through body"
        );
        done();
      }
    });

    it("should be able to redirect and follow redirect", done => {
      const server = new http.Server();
      server.once("request", handleNavigate);
      server.listen(() => {
        fetch(server, "/test").then(data => {
          const res = data[1];
          assert.equal(res.status, 200);
          assert.equal(res.url, "/redirected");
          server.close(done);
        });
      });

      function handleNavigate(req, res) {
        assert.equal(req.url, "/test", "should have navigated");
        server.once("request", handleRedirect);
        res.writeHead(302, { location: "/redirected" });
        res.end();
      }

      function handleRedirect(req, res) {
        assert.equal(req.url, "/redirected", "should have redirected");
        res.end();
      }
    });

    it("should be able to redirect and not follow redirect", done => {
      const server = new http.Server();
      server.once("request", handleNavigate);
      server.listen(() => {
        fetch(server, "/test", { redirect: "manual" }).then(data => {
          const res = data[1];
          assert.equal(res.status, 302);
          assert.equal(res.url, "/test");
          server.close(done);
        });
      });

      function handleNavigate(req, res) {
        assert.equal(req.url, "/test", "should have navigated");
        server.once("request", handleRedirect);
        res.writeHead(302, { location: "/redirected" });
        res.end();
      }

      function handleRedirect(req, res) {
        assert.fail("should not have redirected");
      }
    });

    it("should accept a fetch request", done => {
      const server = new http.Server(checkCompleted);
      server.listen(() => {
        fetch(
          server,
          new Request("/test", {
            headers: {
              a: "1",
              b: "2"
            },
            method: "POST"
          })
        );
      });

      function checkCompleted(req, res) {
        assert.ok(server.listening, "server should be listening");
        assert.ok(
          req instanceof http.IncomingMessage,
          "should have IncomingMessage"
        );
        assert.ok(
          res instanceof http.ServerResponse,
          "should have ServerResponse"
        );
        assert.equal(req.url, "/test", "should have proper url");
        assert.equal(req.headers.a, "1", "should have copied headers");
        assert.equal(req.headers.b, "2", "should have copied headers");
        server.close(done);
      }
    });
  });
});

/**
 * Creates an element and attaches it to the dom.
 */
function createEl(tag: string, attrs?: any) {
  const el = document.createElement(tag);
  for (const name in attrs) {
    el.setAttribute(name, attrs[name]);
  }

  document.body.appendChild(el);
  return el;
}

/**
 * Triggers a fake click event.
 */
function clickEl(el) {
  const ev = document.createEvent("MouseEvent");
  ev.initMouseEvent(
    "click",
    true,
    true,
    window,
    null,
    0,
    0,
    0,
    0,
    false,
    false,
    false,
    false,
    0,
    null
  );
  el.dispatchEvent(ev);
}

/**
 * Adds an event listener for on event and ensures the default is prevented.
 */
function once(type, el, fn) {
  window.addEventListener(
    type,
    function prevent(e) {
      if (e.target !== el) {
        return;
      }

      window.removeEventListener(type, prevent);

      try {
        fn(e);
      } catch (err) {
        throw err;
      } finally {
        if (!e.defaultPrevented) {
          e.preventDefault();
        }
      }
    },
    false
  );
}
