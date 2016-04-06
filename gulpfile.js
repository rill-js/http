var fs = require('fs')
var gulp = require('gulp')
var mocha = require('gulp-mocha-phantomjs')
var webserver = require('gulp-webserver')
var source = require('vinyl-source-stream')
var browserify = require('browserify')
var tests = './test'

/*
* Build tests for the browser.
*/
gulp.task('build-test', function () {
  return browserify({
    entries: fs.readdirSync(tests)
      .filter(function (file) { return file.endsWith('Test.js') })
      .map(function (file) { return tests + '/' + file }),
    extensions: ['.js'],
    debug: true
  })
    .bundle()
    .on('error', function (err) { console.log(err.toString()) })
    .pipe(source('run.js'))
    .pipe(gulp.dest(tests))
})

/*
* Run tests.
*/
gulp.task('test', ['build-test'], function () {
  var browser = mocha()
  var server = gulp.src('.').pipe(webserver())
  browser.write({ path: 'http://localhost:8000/test/run.html' })
  browser.on('finish', function () { server.emit('kill') })
  return browser.end()
})
