module.exports = {
	flattenQuery: flattenQuery
};

var toString = Object.prototype.toString;
/**
 * @description
 * Go from regular object syntax to a querystring style object.
 *
 * @example
 * var result = unflatten({ a: { b: 1 }, c: { d: 1 } });
 * result; //-> { "a[b]": 1, "c[d]": 2 }
 *
 * @param {Object} obj
 */
function flattenQuery (obj, path, result) {
	result = result || {};

	var val;
	for (var key in obj) {
		val = obj[key];
		if (!obj.hasOwnProperty(key))
			continue;
		else if (toString.call(val) === "[object Object]")
			flattenQuery(val, path ? path + "[" + key + "]" : key, result)
		else
			result[path ? path + "[" + key + "]" : key] = val;
	}

	return result;
}