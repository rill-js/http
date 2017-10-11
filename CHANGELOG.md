# Change Log
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/)
and this project adheres to [Semantic Versioning](http://semver.org/).

## 6.0.0 - 2017-10-10
### Changed
- Removes and moves some hidden `_properties` from `IncomingMessage`. (Requires an update to @rill/static).
- Better support for typescript with improved JSDoc.
- Moves initialization of non-methods to the constructor instead of the prototype for server-response.
- Update dev dependencies.

## 5.0.2 - 2017-05-18
### Changed
- Update dev dependencies.

## 5.0.0, 5.0.1 - 2017-05-18
### Changed
- Rename 'browser' adapter to 'document' to avoid confusion.
- Change adapter api to expose { fetch, attach }.
- Improve documentation.

## 4.3.1, 4.3.2, 4.3.3 - 2017-03-28
### Changed
- Update dependencies.

## 4.3.0 - 2017-03-23
### Changed
- Fetch api is now always async.

## 4.2.0, 4.2.1 - 2017-03-23
### Changed
- Add 'files' and 'query' options to browser fetch api.
- Allow for first argument to fetch api to be a url string.

## 4.1.3 - 2017-03-23
### Changed
- Fix regression with parsing querystrings on GET forms.

## 4.1.2 - 2017-03-18
### Changed
- Improved inline JSDocs.

## 4.1.1 - 2017-03-14
### Changed
- Fixed regression with referrer not being the full href.

## 4.1.0 - 2017-03-11
### Changed
- Switched to custom url/querystring parser and serializer. Optimized file size.
- Reduced fetch api flexability to make fetch polyfill optional.
- Fetch api now supports a 'form' option which will automatically parse forms.
- Fetch api now sends out body as a regular array, moved blob creation to userland as per readme.

## 3.1.0 - 2017-03-4
### Changed
- No longer use node's buffer module to build response body's. Now uses blobs (ie10+).


## 3.0.0, 3.0.1 - 2016-10-31
### Changed
- Large refactor
- 100% test coverage
- Saucelabs testing
- Travis CI
- Support IE9+ (previously IE10+) thanks in part to [html5-history-api](https://github.com/devote/HTML5-History-API)
- Now will work in web workers and pretty much anywhere that runs js.
- BrowserAdapter#Navigate now has the same API as WHATWG fetch.
