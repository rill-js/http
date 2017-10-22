import { get as getLoc } from "get-loc";
import { get as getWin } from "get-win";
import { stringify as stringifyQS } from "mini-querystring";
import { parse as parseURL } from "mini-url";
import { parse as parseForm } from "parse-form";
import * as T from "../_types";
import { _createIncomingMessage, IncomingMessage } from "../incoming-message";
import { Server } from "../server";
import { _createServerResponse, ServerResponse } from "../server-response";

// @internal
interface IDocumentServer extends Server {
  _referrer: string;
  _initialize: boolean;
  _pending_load: any;
  _pending_refresh: any;
  _onHistory: (this: Server) => any;
  _onSubmit: (this: Server) => any;
  _onClick: (this: Server) => any;
}

const window = getWin();
const { history, document } = window;

/**
 * @description
 * Emulates node js http server in the browser by hijacking links and forms.
 *
 * @param server The @rill/http server to attach to.
 * @param initialize If false the initial request will be skipped.
 */
export function attach(server: Server, initialize?: boolean): Server {
  const it = server as IDocumentServer;
  // Add browser specific hidden server vars.
  it._referrer = document.referrer;
  it._initialize = initialize !== false;
  // Setup link/form hijackers.
  it._onHistory = onHistory.bind(it);
  it._onSubmit = onSubmit.bind(it);
  it._onClick = onClick.bind(it);
  // Register link/form hijackers.
  it.prependListener("listening", onListening);
  // Teardown link/form hijackers
  it.prependListener("close", onClosing);
  return server;
}

/**
 * Add event listeners to the browser once the server has started listening.
 */
function onListening(this: IDocumentServer): void {
  window.addEventListener("popstate", this._onHistory);
  window.addEventListener("submit", this._onSubmit);
  window.addEventListener("click", this._onClick);
  this.prependListener("request", onRequest);
  // Trigger initial load event.
  this._pending_load = this._initialize && setTimeout(this._onHistory, 0);
}

/**
 * Removes any attached event listeners once a server closes.
 */
function onClosing(this: IDocumentServer): void {
  window.removeEventListener("popstate", this._onHistory);
  window.removeEventListener("submit", this._onSubmit);
  window.removeEventListener("click", this._onClick);
  this.removeListener("request", onRequest);
  clearTimeout(this._pending_load);
  clearTimeout(this._pending_refresh);
}

/**
 * Handle incoming requests and add a listener for when it is complete.
 */
function onRequest(req: IncomingMessage, res: ServerResponse): void {
  // Set referrer automatically.
  req.headers.referer =
    req.headers.referer || (req.socket.server as IDocumentServer)._referrer;
  // Trigger cleanup on request finish.
  res.once("finish", onFinish.bind(null, req, res));
}

/**
 * Handle completed requests by updating location, cookies, etc.
 */
function onFinish(req: IncomingMessage, res: ServerResponse): void {
  const options = req._options;
  const parsed = options.parsed as T.URL;
  const server = req.socket.server as IDocumentServer;

  // Any navigation during a 'refresh' will cancel the refresh.
  clearTimeout(server._pending_refresh);

  // Check if we should set some cookies.
  const cookies = res.getHeader("set-cookie");
  if (cookies && cookies.length) {
    if (typeof cookies === "string") {
      // Set a single cookie.
      document.cookie = cookies;
    } else {
      // Set multiple cookie header.
      for (const cookie of cookies) {
        document.cookie = cookie;
      }
    }
  }

  // Check to see if a refresh was requested.
  const refresh = res.getHeader("refresh");
  if (refresh) {
    const parts = String(refresh).split(" url=");
    const timeout = parseInt(parts[0], 10) * 1000;
    const redirectURL = parts[1];
    // This handles refresh headers similar to browsers by waiting a timeout, then navigating.
    server._pending_refresh = setTimeout(
      fetch.bind(null, server, { url: redirectURL }),
      timeout
    );
  }

  // Only update URL on non redirected GET requests.
  if (req.method !== "GET" || res.getHeader("Location")) {
    return;
  }

  // Don't push the same url twice.
  /* istanbul ignore next */
  if (server._referrer === parsed.href) {
    return;
  }

  // Save last url for referer header.
  server._referrer = parsed.href;

  if (options.history !== false) {
    // Scrolls to top of document (if we are on a new page).
    window.scrollTo(0, 0);
    // Update the href in the browser.
    history.pushState(null, document.title, req.url);
  }
}

/**
 * Handles history state changes (back or startup) and pushes them through the server.
 */
function onHistory(this: IDocumentServer, e?: Event): void {
  // Skip hash only changes.
  /* istanbul ignore next */
  if (
    e &&
    location.hash &&
    location.href.replace(this._referrer, "") === location.hash
  ) {
    return;
  }

  fetch(this, { url: location.href, history: false });
}

/**
 * Handles intercepting forms and pushes them through the server.
 */
function onSubmit(this: IDocumentServer, e: Event): void {
  // Ignore canceled events.
  if (e.defaultPrevented) {
    return;
  }

  // Get the <form> element.
  const el = e.target as HTMLFormElement;
  /* istanbul ignore next */
  const action = el.action || el.getAttribute("action") || "";
  // Parse out host and protocol.
  const parsed = parseURL(action, location.href);

  if (
    // Ignore the click if the element has a target.
    (el.target && el.target !== "_self") ||
    // Ignore links from different host.
    parsed.host !== location.host ||
    // Ignore links from different protocol.
    parsed.protocol !== location.protocol
  ) {
    return;
  }

  // Prevent default request.
  e.preventDefault();

  // Submit the form to the server.
  fetch(this, {
    form: el,
    method:
      el.method ||
      /* istanbul ignore next */ (el.getAttribute("method") as string),
    url: action as string
  });

  // Check for special data-noreset option (disables Automatically resetting the form.)
  // This is not a part of the official API because I hate the name data-reset and I
  // feel like there should be a better approach to this.
  /* istanbul ignore next */
  if (!el.hasAttribute("data-noreset")) {
    el.reset();
  }
}

/**
 * Handle intercepting link clicks and pushes them through the server.
 */
function onClick(this: IDocumentServer, e: MouseEvent): void {
  // Ignore canceled events, modified clicks, and right clicks.
  if (e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey) {
    return;
  }

  // Get the clicked element.
  let el = e.target as HTMLAnchorElement;
  // Find an <a> element that may have been clicked.
  while (el != null && el.nodeName !== "A") {
    el = el.parentNode as HTMLAnchorElement;
  }

  if (
    // Ignore if we couldn't find a link.
    !el ||
    // Ignore clicks from linkless elements.
    !el.href ||
    // Ignore only hash changes.
    (el.hash &&
    (!el.pathname || el.pathname === location.pathname) && // Note `!el.pathname` check is for IE which doesn't parse this properly.
      (!el.search || el.search === location.search)) ||
    // Ignore the click if the element has a target.
    (el.target && el.target !== "_self") ||
    // Ignore 'rel="external"' links.
    (el.rel && el.rel === "external") ||
    // Ignore download links
    el.hasAttribute("download") ||
    // Ignore links from different host.
    (el.host && el.host !== location.host) ||
    // Ignore links from different protocol.
    (el.protocol && el.protocol !== ":" && el.protocol !== location.protocol)
  ) {
    return;
  }

  // Attempt to navigate internally.
  e.preventDefault();
  fetch(this, el.href);
}

/**
 * @description
 * Like native window.fetch but requests from a local mock server.
 *
 * @param server The @rill/http server to request from.
 * @param url The url to request.
 * @param options Fetch style options object (with method, redirect, etc).
 */
export function fetch(
  server: Server,
  url: string | T.FetchOptions,
  options?: T.FetchOptions
) {
  // Allow for both url string or { url: '...' } object.
  if (typeof url === "object") {
    options = url;
  } else if (typeof url === "string") {
    options = { ...options, url };
  }

  // Ensure url was a string.
  if (!options || typeof options.url !== "string") {
    return Promise.reject(
      new TypeError("@rill/http#fetch: url must be a string.")
    );
  }

  // Parse url parts into an object.
  let parsed = (options.parsed = parseURL(
    (options.url as string).replace(/#.*$/, ""), // Omit any hash from requested URL.
    location.href
  ));

  // Return a 'fetch' style response as a promise.
  return new Promise((resolve, reject) => {
    // Create a nodejs style req and res.
    const incomingMessage = _createIncomingMessage(server, options);
    const serverResponse = _createServerResponse(incomingMessage);
    const { form } = options;

    // Handle special form option.
    if (form) {
      // Copy content type from form.
      incomingMessage.headers["content-type"] = form.enctype;
      // Parse form data and override options.
      const { body, files } = parseForm(form);
      options.body = body;
      options.files = files;
    }

    if (incomingMessage.method === "GET") {
      // On get requests with bodies we update the query string.
      const query = options.query || options.body;
      if (query) {
        parsed = options.parsed = parseURL(
          parsed.pathname + "?" + stringifyQS(query, true),
          location.href
        );
      }
    }

    // Set the request url.
    incomingMessage.url =
      (parsed.pathname as string) + (parsed.search as string);

    // Wait for server response to be sent.
    serverResponse.once("finish", () => {
      // Marks incomming message as complete.
      incomingMessage.complete = true;
      incomingMessage.emit("end");

      // Check to see if we should redirect.
      const redirect = serverResponse.getHeader("location");
      if (redirect) {
        // Follow redirect if needed.
        if (options.redirect === undefined || options.redirect === "follow") {
          return resolve(
            fetch(server, {
              history: options.history,
              url: String(redirect)
            })
          );
        }
      }

      // Send out final response data and meta data.
      // This format allows for new Response(...data) when paired with the fetch api.
      return resolve([
        serverResponse._body,
        {
          headers: serverResponse.getHeaders(),
          status: serverResponse.statusCode,
          statusText: serverResponse.statusMessage,
          url: incomingMessage.url
        }
      ]);
    });

    // Trigger request event on server (ensured async).
    setTimeout(
      server.emit.bind(server, "request", incomingMessage, serverResponse),
      0
    );
  });
}
