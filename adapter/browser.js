'use strict'

var window = require('global')
var URL = require('mini-url')
var parseForm = require('parse-form')
var QS = require('mini-querystring')
var location = require('get-loc')()
var IncomingMessage = require('../client/incoming-message')
var ServerResponse = require('../client/server-response')
var history = window.history
var document = window.document

// Expose browser hijacker.
attachBrowser.fetch = fetch
module.exports = attachBrowser['default'] = attachBrowser

/**
 * Emulates node js http server in the browser by hijacking links and forms.
 *
 * @param {Server} server - The @rill/http server to attach to.
 * @param {boolean} [initialize=true] - If there should be an initial request.
 * @return {Server}
 */
function attachBrowser (server, initialize) {
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
 * Handle incomming requests and add a listener for when it is complete.
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
  var parsed = req._options.parsed
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
    var parts = refresh.split(' url=')
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
  if (req._scroll !== false) {
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
  if (req._history !== false) {
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
 * @param {object} e - The <form> submit event.
 * @return {void}
 */
function onSubmit (e) {
  // Ignore canceled events.
  if (e.defaultPrevented) return

  // Get the <form> element.
  var el = e.target
  /* istanbul ignore next */
  var action = el.action || el.getAttribute('action') || ''
  // Parse out host and protocol.
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
 * @param {object} e - The <a> click event.
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
  fetch(this, { url: el.href })
}

/**
 * Like native window.fetch but requests from a local mock server.
 *
 * @param {Server} server - The local server to fetch from.
 * @param {object} opts - Options about the request.
 * @param {boolean} opts.url - The url to navigate to.
 * @param {object} [opts.body] - An request body to pass through as is.
 * @param {HTMLElement} [opts.form] - A form to parse and pass through as the request body.
 * @param {boolean} [opts.scroll] - Should the request trigger a page scroll.
 * @param {boolean} [opts.history] - Should the request update the page url.
 * @param {string|false} [opts.redirect='follow'] - Should we follow any redirects.
 * @api private
 */
function fetch (server, options) {
  if (typeof options !== 'object' || options == null) return Promise.reject(new TypeError('@rill/http/adapter/browser#fetch: options must be an object.'))
  if (typeof options.url !== 'string') return Promise.reject(new TypeError('@rill/http/adapter/browser#fetch: options.url must be a string.'))
  var parsed = options.parsed = URL.parse(options.url, location.href)
  // Return a 'fetch' style response as a promise.
  return new Promise(function (resolve, reject) {
    // Create a nodejs style req and res.
    var incommingMessage = IncomingMessage._createIncomingMessage(server, options)
    var serverResponse = ServerResponse._createServerResponse(incommingMessage)

    // Forward some special options.
    if (options.body) {
      // Allow passing body through directly.
      incommingMessage.body = options.body
    } else if (options.form) {
      // Or provide a form to parse.
      var el = options.form
      var data = parseForm(el)
      /* istanbul ignore next */
      incommingMessage.headers['content-type'] = el.enctype || el.getAttribute('enctype') || 'application/x-www-form-urlencoded'
      if (incommingMessage.method === 'GET') {
        // If we have a form on a get request we replace the search.
        parsed = options.parsed = URL.parse(
          parsed.pathname + '?' + QS.stringify(data.body, true) + parsed.hash,
          location.href
        )
      } else {
        // Otherwise we pass it through.
        incommingMessage.body = data.body
        incommingMessage.files = data.files
      }
    }

    // Set some hidden browser specific options.
    incommingMessage._scroll = options.scroll
    incommingMessage._history = options.history

    // Set the request url.
    incommingMessage.url = parsed.pathname + parsed.search + parsed.hash

    // Wait for server response to be sent.
    serverResponse.once('finish', function handleResponseEnd () {
      // Marks incomming message as complete.
      incommingMessage.complete = true
      incommingMessage.emit('end')

      // Check to see if we should redirect.
      var redirect = serverResponse.getHeader('location')
      if (redirect) {
        // Follow redirect if needed.
        if (options.redirect === undefined || options.redirect === 'follow') {
          return resolve(fetch(server, { url: redirect, history: options.history, scroll: options.scroll }))
        }
      }

      // Send out final response data and meta data.
      // This format allows for new Response(...data) when paired with the fetch api.
      return resolve([serverResponse._body, {
        url: incommingMessage.url,
        headers: serverResponse.getHeaders(),
        status: serverResponse.statusCode,
        statusText: serverResponse.statusMessage
      }])
    })

    // Trigger request event on server.
    server.emit('request', incommingMessage, serverResponse)
  })
}
