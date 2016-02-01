var assert = require("assert");
var URL    = require("url");
var http   = require("../client");

var _uid = 0;
function uid () { return _uid++; }

function createEl (tag, attrs) {
	var el = document.createElement(tag);
	for (var name in attrs) el.setAttribute(name, attrs[name]);
	document.body.appendChild(el);
	return el;
}

function clickEl (el) {
    var ev = document.createEvent("MouseEvent");
    ev.initMouseEvent("click", true, true, window, null, 0, 0, 0, 0, false, false, false, false, 0 , null);
    el.dispatchEvent(ev);
};

function onClick (el, fn, allowDefault) {
	window.addEventListener("click", function _handleClick (e) {
		if (!allowDefault) e.preventDefault();
		window.removeEventListener("click", _handleClick);
	});
	el.addEventListener("click", fn);
}

function afterClick (el, fn, allowDefault) {
	onClick(el, function () { setTimeout(function () { fn() }, 1); }, allowDefault);
}

function onSubmit (el, fn, allowDefault) {
	window.addEventListener("submit", function _handleSubmit (e) {
		if (!allowDefault) e.preventDefault();
		window.removeEventListener("submit", _handleSubmit);
	});
	el.addEventListener("submit", fn);
}

function afterSubmit (el, fn, allowDefault) {
	onSubmit(el, function () { setTimeout(function () { fn() }, 1); }, allowDefault);
}

describe("HTTP", function () {
	describe("Links", function () {
		var server = http.createServer(function (req, res) { res.end(); }).listen();
		afterEach(function () { document.body.innerHTML = ""; });
		after(function () { server.close() });

		it("should handle internal links", function (done) {
			var testURL = "/test-" + uid();
			var el      = createEl("a", { href: testURL });

			assert.ok(location.path !== el.href);

			afterClick(el, function (e) {
				assert.ok(location.href === el.href);
				done();
			}, true);

			clickEl(el);
		});

		it("should ignore default prevented clicks", function (done) {
			var testURL = "/test-" + uid();
			var el      = createEl("a", { href: testURL });

			assert.ok(location.path !== el.href);

			onClick(el, function (e) { e.preventDefault(); })
			afterClick(el, function (e) {
				assert.ok(location.href !== el.href);
				done();
			});

			clickEl(el);
		});

		it("should ignore links without an href", function (done) {
			var el = createEl("a", {});

			onClick(el, function (e) {
				assert.ok(!e.defaultPrevented);
				assert.ok(location.href !== el.href);
				done();
			});

			clickEl(el);
		});

		it("should ignore rel external links", function (done) {
			var el = createEl("a", { href: "/", rel: "external" });

			onClick(el, function (e) {
				assert.ok(!e.defaultPrevented);
				assert.ok(location.href !== el.href);
				done();
			});

			clickEl(el);
		});

		it("should ignore target links", function (done) {
			var el = createEl("a", { href: "/", target: "_blank" });

			onClick(el, function (e) {
				assert.ok(!e.defaultPrevented);
				assert.ok(location.href !== el.href);
				done();
			});

			clickEl(el);
		});

		it("should ignore different protocol links", function (done) {
			var el = createEl("a", { href: "https://localhost:8000/" });

			onClick(el, function (e) {
				assert.ok(!e.defaultPrevented);
				assert.ok(location.href !== el.href);
				done();
			});

			clickEl(el);
		});

		it("should ignore links with a different host", function (done) {
			var el = createEl("a", { href: "http://google.ca" });

			assert.ok(location.path !== el.href);

			onClick(el, function (e) {
				assert.ok(!e.defaultPrevented);
				assert.ok(location.href !== el.href);
				done();
			});

			clickEl(el);
		});

		it("should ignore links with a download attribute", function (done) {
			var el = createEl("a", { href: "http://google.ca", download: "test.file" });

			assert.ok(location.path !== el.href);

			onClick(el, function (e) {
				assert.ok(!e.defaultPrevented);
				assert.ok(location.href !== el.href);
				done();
			});

			clickEl(el);
		});
	});

	describe("Forms", function () {
		var formData;
		var formQuery;
		var server = http.createServer(function (req, res) {
			formData = req.body;
			formURL  = req.url;
			res.end();
		}).listen();
		afterEach(function () {
			formData                =
			formURL                 = undefined;
			document.body.innerHTML = "";
		});
		after(function () { server.close() });

		it("should handle internal body forms", function (done) {
			var testURL = "/test-" + uid();
			var el      = createEl("form", { action: testURL, method: "POST" });
			var input   = createEl("input", { name: "test", value: "1" });
			var submit  = createEl("button", { type: "submit" });
			el.appendChild(input);
			el.appendChild(submit);

			afterSubmit(el, function () {
				assert.ok(formData.test);
				done();
			});

			clickEl(submit);
		});

		it("should handle internal GET forms with querystring", function (done) {
			var testURL = "/test-" + uid();
			var el      = createEl("form", { action: testURL, method: "GET" });
			var input   = createEl("input", { name: "test", value: "1" });
			var submit  = createEl("button", { type: "submit" });
			el.appendChild(input);
			el.appendChild(submit);

			afterSubmit(el, function () {
				var query = URL.parse(formURL, true).query;
				assert.equal(query.test, 1);
				done();
			});

			clickEl(submit);
		});

		it("should ignore default prevented clicks", function (done) {
			var testURL = "/test-" + uid();
			var el      = createEl("form", { action: testURL, method: "POST" });
			var input   = createEl("input", { name: "test", value: "1" });
			var submit  = createEl("button", { type: "submit" });
			el.appendChild(input);
			el.appendChild(submit);

			onSubmit(el, function (e) { e.preventDefault(); }, true);
			afterSubmit(el, function () {
				assert.equal(formData, undefined);
				done();
			});

			clickEl(submit);
		});

		it("should ignore forms without an action", function (done) {
			var el      = createEl("form", { method: "POST" });
			var input   = createEl("input", { name: "test", value: "1" });
			var submit  = createEl("button", { type: "submit" });
			el.appendChild(input);
			el.appendChild(submit);

			onSubmit(el, function () {
				assert.equal(formData, undefined);
				done();
			});

			clickEl(submit);
		});

		it("should ignore target forms", function (done) {
			var testURL = "/test-" + uid();
			var el      = createEl("form", { action: testURL, method: "POST", target: "_blank" });
			var input   = createEl("input", { name: "test", value: "1" });
			var submit  = createEl("button", { type: "submit" });
			el.appendChild(input);
			el.appendChild(submit);

			afterSubmit(el, function () {
				assert.equal(formData, undefined);
				done();
			});

			clickEl(submit);
		});

		it("should ignore different protocol forms", function (done) {
			var el      = createEl("form", { action: "https://localhost:8000/", method: "POST" });
			var input   = createEl("input", { name: "test", value: "1" });
			var submit  = createEl("button", { type: "submit" });
			el.appendChild(input);
			el.appendChild(submit);

			afterSubmit(el, function () {
				assert.equal(formData, undefined);
				done();
			});

			clickEl(submit);
		});

		it("should ignore links with a different host", function (done) {
			var el      = createEl("form", { action: "http://google.ca", method: "POST" });
			var input   = createEl("input", { name: "test", value: "1" });
			var submit  = createEl("button", { type: "submit" });
			el.appendChild(input);
			el.appendChild(submit);

			afterSubmit(el, function () {
				assert.equal(formData, undefined);
				done();
			});

			clickEl(submit);
		});
	});
});
