# Files
NM = node_modules
BIN = $(NM)/.bin
TESTS_IN = test/*.test.js
TESTS_OUT = test/run.js

# Tools
standard = $(BIN)/standard
snazzy = $(BIN)/snazzy
coveralls = $(BIN)/coveralls
istanbul = $(BIN)/istanbul
mocha = $(BIN)/_mocha
jsdom = .jsdom.js
browserify = $(BIN)/browserify

# Run standard linter.
lint:
	$(standard) --fix --verbose | $(snazzy)

# Save code coverage to coveralls
coveralls:
	cat coverage/lcov.info | $(coveralls)

# Run standard linter, mocha tests and istanbul coverage.
test:
	@NODE_ENV=test \
		$(istanbul) cover \
		$(mocha) --require $(jsdom) --report html -- -u exports $(TESTS_IN)

# Run standard linter, mocha tests and istanbul coverage but bail early and only save lcov coverage report.
test-ci:
	@NODE_ENV=test \
		${istanbul} cover \
		$(mocha) --require $(jsdom) --report lcovonly -- -u exports $(TESTS_IN) --bail

# Build tests for browser.
build-test:
	@NODE_ENV=test \
		$(browserify) --debug $(TESTS_IN) > $(TESTS_OUT)

.PHONY: test
