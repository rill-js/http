'use strict'

var URL = require('url')
var window = require('global')
var parseForm = require('parse-form')
var history = window.history
var document = window.document
var LINK = document.createElement('a')
/* istanbul ignore next */
var location = (window.history && window.history.location) || window.location || { href: '' }

// Expose browser hijacker.
module.exports = attachBrowser

/**
 * Emulates node js http server in the browser by hijacking links and forms.
 *
 * @param {Server} server - the @rill/http server
 */
function attachBrowser (server) {
  server._pending_refresh = null
  // Setup link/form hijackers.
  server._onHistory = onHistory.bind(server)
  server._onSubmit = onSubmit.bind(server)
  server._onClick = onClick.bind(server)
  // Register link/form hijackers.
  server.once('listening', onListening)
  // Teardown link/form hijackers
  server.once('close', onClosing)
  return server
}

/**
 * Handle server listening
 */
function onListening () {
  window.addEventListener('popstate', this._onHistory)
  window.addEventListener('submit', this._onSubmit)
  window.addEventListener('click', this._onClick)
  // This is hacky because the browser version of the events module does not support `prependListener`.
  // See: https://github.com/Gozala/events/issues/29
  if (this._events['request']) {
    this._events['request'] = [onRequest].concat(this._events['request'])
  } else {
    this.on('request', onRequest)
  }

  // Trigger the initial page load (works the same as a popstate).
  this._onHistory()
}

/**
 * Handle server closing
 */
function onClosing () {
  window.removeEventListener('popstate', this._onHistory)
  window.removeEventListener('submit', this._onSubmit)
  window.removeEventListener('click', this._onClick)
  this.removeListener('request', onRequest)
}

/**
 * Handle incomming requests and add a litener for when it is complete.
 */
function onRequest (req, res) {
  req._res = res
  req.once('end', onEnd)
}

/**
 * Handle completed requests.
 */
function onEnd () {
  var req = this
  var res = req._res
  var parsed = req._parsed
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
      server.navigate.bind(server, redirectURL),
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
  if (req._scroll !== false) {
    if (parsed.hash == null) window.scrollTo(0, 0)
    else {
      var target = document.getElementById(parsed.hash.slice(1))
      if (target) {
        /* istanbul ignore next */
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
  if (req.headers.referer === req.url) return

  // Update the href in the browser.
  if (req._history !== false) {
    history.pushState(null, document.title, req.url)
  }
}

/*
 * Handle an a history state change (back or startup) event.
 */
function onHistory () {
  this.navigate(location.href, { scroll: false, history: false })
}

/*
 * Handle intercepting forms to update the url.
 *
 * @param {Object} e
 */
function onSubmit (e) {
  // Ignore canceled events.
  if (e.defaultPrevented) return

  // Get the <form> element.
  var el = e.target
  /* istanbul ignore next */
  var action = el.action || el.getAttribute('action') || ''
  /* istanbul ignore next */
  var method = (el.method || el.getAttribute('method') || 'GET').toUpperCase()
  /* istanbul ignore next */
  var contentType = el.enctype || el.getAttribute('enctype') || 'application/x-www-form-urlencoded'

  // Ignore the click if the element has a target.
  if (el.target && el.target !== '_self') return
  // Assign action to link href to parse out host and protocol.
  LINK.href = action
  // Ignore links from different host.
  if (LINK.host && LINK.host !== location.host) return
  // Ignore links from different protocol.
  if (LINK.protocol && LINK.protocol !== ':' && LINK.protocol !== location.protocol) return

  // Prevent default request.
  e.preventDefault()

  // Parse out form data into a javascript object.
  var data = parseForm(el, true)

  // Parse form data into javascript object.
  if (method === 'GET') {
    // On a get request a forms body is converted into a query string.
    var parsed = URL.parse(action)
    // We delete the search part so that a query object can be used.
    delete parsed.search
    parsed.query = data.body
    this.navigate(URL.format(parsed))
  } else {
    // Otherwise we submit the data as is.
    data.method = method
    data.headers = { 'content-type': contentType }
    this.navigate(action, data)
  }

  // Check for special data-noreset option (disables Automatically resetting the form.)
  // This is not a part of the official API because I hate the name data-reset and I feel like there should be a better approach to this.
  /* istanbul ignore next */
  if (!el.hasAttribute('data-noreset')) el.reset()
}

/*
 * Handle intercepting link clicks to update the url.
 *
 * @param {Object} e
 */
function onClick (e) {
  // Ignore canceled events, modified clicks, and right clicks.
  if (
    e.defaultPrevented ||
    e.metaKey ||
    e.ctrlKey ||
    e.shiftKey ||
    e.button !== 0
    ) return
  // Get the clicked element.
  var el = e.target

  // Check for submit button and ensure it has focus.
  // This fixes an issue with safari where buttons never get focus.
  // Fixes form submission parsing when using buttons with values.
  if (el.type === 'submit' && el !== document.activeElement) {
    el.focus()
    return
  }

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
  // Ignore links from different host.
  if (el.host && el.host !== location.host) return
  // Ignore links from different protocol.
  if (el.protocol && el.protocol !== ':' && el.protocol !== location.protocol) return
  // Ignore download links
  if (el.hasAttribute('download')) return

  // Attempt to navigate internally.
  e.preventDefault()
  this.navigate(el.href)
}
