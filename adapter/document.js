// @ts-check
/** Type Definitions */
/** @module rill/http/adapter/document */
/**
 * @typedef {object} FetchOptions
 * @property {string} [url] - The url to fetch.
 * @property {string} [method='GET'] - The http method to use.
 * @property {HTMLFormElement} [form] - A form element to submit as the body.
 * @property {object} [query] - A request query to add to the url.
 * @property {object} [body] - A request body to pass through as is.
 * @property {object} [files] - An object with files to add to the request body.
 * @property {boolean} [scroll] - Should the request trigger a page scroll.
 * @property {boolean} [history] - Should the request update the page url.
 * @property {string|false} [redirect='follow'] - Should we follow any redirects.
 * @property {object} [parsed] - A parsed URL for the request.
 */
'use strict'

/** @type {object} */
var window = require('global')
var URL = require('mini-url')
var parseForm = require('parse-form')
var QS = require('mini-querystring')
var location = require('get-loc')()
var IncomingMessage = require('../client/incoming-message')
var ServerResponse = require('../client/server-response')
var history = window.history
var document = window.document
exports.fetch = fetch
exports.attach = attach

/**
 * Emulates node js http server in the browser by hijacking links and forms.
 *
 * @param {http.Server} server - The @rill/http server to attach to.
 * @param {boolean} [initialize=true] - If there should be an initial request.
 * @return {http.Server}
 */
function attach (server, initialize) {
  server._referrer = document && document.referrer
  server._initialize = initialize !== false
  server._pending_refresh = null
  // Setup link/form hijackers.
  server._onHistory = onHistory.bind(server)
  server._onSubmit = onSubmit.bind(server)
  server._onClick = onClick.bind(server)
  // Register link/form hijackers.
  server.prependListener('listening', onListening)
  // Teardown link/form hijackers
  server.prependListener('close', onClosing)
  return server
}

/**
 * Add event listeners to the browser once the server has started listening.
 *
 * @return {void}
 */
function onListening () {
  window.addEventListener('popstate', this._onHistory)
  window.addEventListener('submit', this._onSubmit)
  window.addEventListener('click', this._onClick)
  this.prependListener('request', onRequest)
  // Trigger initial load event.
  this._pending_load = this._initialize && setTimeout(this._onHistory, 0)
}

/**
 * Removes any attached event listeners once a server closes.
 *
 * @return {void}
 */
function onClosing () {
  window.removeEventListener('popstate', this._onHistory)
  window.removeEventListener('submit', this._onSubmit)
  window.removeEventListener('click', this._onClick)
  this.removeListener('request', onRequest)
  clearTimeout(this._pending_load)
  clearTimeout(this._pending_refresh)
}

/**
 * Handle incoming requests and add a listener for when it is complete.
 *
 * @param {IncomingMessage} req - The mock server request.
 * @param {ServerResponse} res - The mock server response.
 * @return {void}
 */
function onRequest (req, res) {
  // Set referrer automatically.
  req.headers.referer = req.headers.referer || req.socket.server._referrer
  // Trigger cleanup on request finish.
  res.once('finish', onFinish.bind(null, req, res))
}

/**
 * Handle completed requests by updating location, scroll, cookies, etc.
 *
 * @param {IncomingMessage} req - The mock server request.
 * @param {ServerResponse} res - The mock server response.
 * @return {void}
 */
function onFinish (req, res) {
  var options = req._options
  var parsed = options.parsed
  var server = req.socket.server

  // Any navigation during a 'refresh' will cancel the refresh.
  clearTimeout(server._pending_refresh)

  // Check if we should set some cookies.
  var cookies = res.getHeader('set-cookie')
  if (cookies && cookies.length) {
    if (typeof cookies === 'string') {
      // Set a single cookie.
      document.cookie = cookies
    } else {
      // Set multiple cookie header.
      for (var i = 0; i < cookies.length; i++) {
        document.cookie = cookies[i]
      }
    }
  }

  // Check to see if a refresh was requested.
  var refresh = res.getHeader('refresh')
  if (refresh) {
    var parts = String(refresh).split(' url=')
    var timeout = parseInt(parts[0], 10) * 1000
    var redirectURL = parts[1]
    // This handles refresh headers similar to browsers by waiting a timeout, then navigating.
    server._pending_refresh = setTimeout(
      fetch.bind(null, server, { url: redirectURL }),
      timeout
    )
  }

  // We don't do hash scrolling or a url update unless it is a GET request.
  if (req.method !== 'GET') return

  // We don't do hash scrolling or a url update on redirects.
  /* istanbul ignore next */
  if (res.getHeader('location')) return

  /*
   * When navigating a user will be brought to the top of the page.
   * If the urls contains a hash that is the id of an element (a target) then the target will be scrolled to.
   * This is similar to how browsers handle page transitions natively.
   */
  /* istanbul ignore next */
  if (options.scroll !== false) {
    if (parsed.hash === '') window.scrollTo(0, 0)
    else {
      var target = document.getElementById(parsed.hash.slice(1))
      /* istanbul ignore next */
      if (target && target.scrollIntoView) {
        target.scrollIntoView({
          block: 'start',
          // Only use smooth scrolling if we are on the page already.
          behavior: (
            location.pathname === parsed.pathname &&
            (location.search || '') === (parsed.search || '')
          ) ? 'smooth' : 'auto'
        })
      }
    }
  }

  // Don't push the same url twice.
  /* istanbul ignore next */
  if (req.headers.referer === parsed.href) return
  else server._referrer = parsed.href

  // Update the href in the browser.
  /* istanbul ignore next */
  if (options.history !== false) {
    history.pushState(null, document.title, req.url)
  }
}

/**
 * Handles history state changes (back or startup) and pushes them through the server.
 *
 * @return {void}
 */
function onHistory () {
  fetch(this, { url: location.href, scroll: false, history: false })
}

/**
 * Handles intercepting forms and pushes them through the server.
 *
 * @param {Event} e - The <form> submit event.
 * @return {void}
 */
function onSubmit (e) {
  // Ignore canceled events.
  if (e.defaultPrevented) return

  // Get the <form> element.
  /** @type {HTMLFormElement} */
  var el = e.target
  /* istanbul ignore next */
  var action = el.action || el.getAttribute('action') || ''
  // Parse out host and protocol.
  /** @type {object} */
  var parsed = URL.parse(action, location.href)

  // Ignore the click if the element has a target.
  if (el.target && el.target !== '_self') return
  // Ignore links from different host.
  if (parsed.host !== location.host) return
  // Ignore links from different protocol.
  if (parsed.protocol !== location.protocol) return

  // Prevent default request.
  e.preventDefault()

  // Submit the form to the server.
  /* istanbul ignore next */
  fetch(this, { url: action, method: el.method || el.getAttribute('method'), form: el })

  // Check for special data-noreset option (disables Automatically resetting the form.)
  // This is not a part of the official API because I hate the name data-reset and I feel like there should be a better approach to this.
  /* istanbul ignore next */
  if (!el.hasAttribute('data-noreset')) el.reset()
}

/**
 * Handle intercepting link clicks and pushes them through the server.
 *
 * @param {MouseEvent} e - The <a> click event.
 * @return {void}
 */
function onClick (e) {
  // Ignore canceled events, modified clicks, and right clicks.
  if (
    e.defaultPrevented ||
    e.button ||
    e.metaKey ||
    e.ctrlKey ||
    e.shiftKey
  ) return

  // Get the clicked element.
  /** @type {HTMLAnchorElement} */
  var el = e.target
  // Find an <a> element that may have been clicked.
  while (el != null && el.nodeName !== 'A') el = el.parentNode

  // Ignore if we couldn't find a link.
  if (!el) return
  // Ignore clicks from linkless elements.
  if (!el.href) return
  // Ignore the click if the element has a target.
  if (el.target && el.target !== '_self') return
  // Ignore 'rel="external"' links.
  if (el.rel && el.rel === 'external') return
  // Ignore download links
  if (el.hasAttribute('download')) return
  // Ignore links from different host.
  if (el.host && el.host !== location.host) return
  // Ignore links from different protocol.
  if (el.protocol && el.protocol !== ':' && el.protocol !== location.protocol) return

  // Attempt to navigate internally.
  e.preventDefault()
  fetch(this, el.href)
}

/**
 * Like native window.fetch but requests from a local mock server.
 *
 * @param {http.Server} server - The local server to fetch from.
 * @param {string|FetchOptions} url - The url to navigate to.
 * @param {FetchOptions} [options] - Options about the request.
 * @param {object} [options.body] - An request body to pass through as is.
 * @param {HTMLElement} [options.form] - A form to parse and pass through as the request body.
 * @param {boolean} [options.scroll] - Should the request trigger a page scroll.
 * @param {boolean} [options.history] - Should the request update the page url.
 * @param {string|false} [options.redirect='follow'] - Should we follow any redirects.
 * @api private
 */
function fetch (server, url, options) {
  // Allow for both url string or { url: '...' } object.
  if (typeof url === 'object') {
    options = url
  } else if (typeof url === 'string') {
    options = options || {}
    options.url = url
  }

  // Ensure url was a string.
  if (!options || typeof options.url !== 'string') {
    return Promise.reject(new TypeError('@rill/http/adapter/browser#fetch: url must be a string.'))
  }

  // Parse url parts into an object.
  /** @type {object} */
  var parsed = options.parsed = URL.parse(options.url, location.href)

  // Return a 'fetch' style response as a promise.
  return new Promise(function (resolve, reject) {
    // Create a nodejs style req and res.
    var incomingMessage = IncomingMessage._createIncomingMessage(server, options)
    var serverResponse = ServerResponse._createServerResponse(incomingMessage)
    var form = options.form

    // Handle special form option.
    if (form) {
      // Copy content type from form.
      incomingMessage.headers['content-type'] = (
        form.enctype ||
        /* istanbul ignore next */
        form.getAttribute('enctype') ||
        /* istanbul ignore next */
        'application/x-www-form-urlencoded'
      )

      // Parse form data and override options.
      var formData = parseForm(form)
      options.body = formData.body
      options.files = formData.files
    }

    if (incomingMessage.method === 'GET') {
      // On get requests with bodies we update the query string.
      var query = options.query || options.body
      if (query) {
        parsed = options.parsed = URL.parse(
          parsed.pathname + '?' + QS.stringify(query, true) + parsed.hash,
          location.href
        )
      }
    }

    // Set the request url.
    incomingMessage.url = parsed.pathname + parsed.search + parsed.hash

    // Wait for server response to be sent.
    serverResponse.once('finish', function handleResponseEnd () {
      // Marks incomming message as complete.
      incomingMessage.complete = true
      incomingMessage.emit('end')

      // Check to see if we should redirect.
      var redirect = serverResponse.getHeader('location')
      if (redirect) {
        // Follow redirect if needed.
        if (options.redirect === undefined || options.redirect === 'follow') {
          return resolve(fetch(server, {
            url: String(redirect),
            history: options.history,
            scroll: options.scroll
          }))
        }
      }

      // Send out final response data and meta data.
      // This format allows for new Response(...data) when paired with the fetch api.
      return resolve([serverResponse._body, {
        url: incomingMessage.url,
        headers: serverResponse.getHeaders(),
        status: serverResponse.statusCode,
        statusText: serverResponse.statusMessage
      }])
    })

    // Trigger request event on server (ensured async).
    setTimeout(server.emit.bind(server, 'request', incomingMessage, serverResponse), 0)
  })
}
