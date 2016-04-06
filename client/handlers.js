'use strict'

var URL = require('url')
var parseForm = require('parse-form')
var location = window.history.location || window.location
var relReg = /(?:^|\s+)external(?:\s+|$)/

module.exports = {
  onPopState: onPopState,
  onSubmit: onSubmit,
  onClick: onClick
}

/*
 * Handle an a pop state (back) event.
 *
 * @param {Object} e
 */
function onPopState (e) {
  this.navigate(location.href, { popState: true })
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
  var submitted = false
  var target = getAttribute(el, 'target')
  var action = getAttribute(el, 'action')
  var method = getAttribute(el, 'method').toUpperCase()
  var data = parseForm(el, true)

  // Ignore the click if the element has a target.
  if (target && target !== '_self') return

  if (method === 'GET') {
    // On a get request a forms body is converted into a query string.
    var parsed = URL.parse(URL.resolve(location.href, action))
    // We delete the search part so that a query object can be used.
    delete parsed.search
    parsed.query = data.body
    submitted = this.navigate(URL.format(parsed))
  } else {
    submitted = this.navigate({
      url: action,
      method: method,
      body: data.body,
      files: data.files,
      headers: { 'content-type': getAttribute(el, 'enctype') }
    })
  }

  if (!el.hasAttribute('data-noreset')) el.reset()
  if (submitted) e.preventDefault()
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

  // Get the <a> element.
  var el = e.target
  while (el != null && el.nodeName !== 'A') el = el.parentNode

  // Ignore if we couldn't find a link.
  if (!el) return

  var href = getAttribute(el, 'href')
  var target = getAttribute(el, 'target')
  var rel = getAttribute(el, 'rel')

  // Ignore clicks from linkless elements
  if (!href) return
  // Ignore the click if the element has a target.
  if (target && target !== '_self') return
  // Ignore 'rel="external"' links.
  if (relReg.test(rel)) return
  // Ignore downloadable links.
  if (el.hasAttribute('download')) return
  // Attempt to navigate internally.
  if (this.navigate(href)) e.preventDefault()
}

/*
 * Better get attribute with fall backs.
 * In some browsers default values like a forms method are not propigated to getAttribute.
 * This will check a forms attribute and properties.
 *
 * @param {HTMLEntiry} el
 * @param {String} attr
 * @return {String}
 */
function getAttribute (el, attr) {
  var val = el.getAttribute(attr) || el[attr]
  return typeof val === 'string' ? val : ''
}
