const require_rolldown_runtime = require('../_virtual/rolldown_runtime.cjs');
let hash_js = require("hash.js");
hash_js = require_rolldown_runtime.__toESM(hash_js);
let json_stringify_safe = require("json-stringify-safe");
json_stringify_safe = require_rolldown_runtime.__toESM(json_stringify_safe);
let ms = require("ms");
ms = require_rolldown_runtime.__toESM(ms);

//#region src/helpers/strings.ts
const { sha256 } = hash_js.default;
/**
* Safely `JSON.stringify()` an `input`, handling circular refernences and
* removing `BigInt` values.
*/
const stringify = (input) => {
	return (0, json_stringify_safe.default)(input, (_key, value) => {
		if (typeof value !== "bigint") return value;
	});
};
/**
* Returns a slugified string used to generate consistent IDs.
*
* This can be used to generate a consistent ID for a function when migrating
* from v2 to v3 of the SDK.
*
* @public
*/
const slugify = (str) => {
	const join = "-";
	return str.toLowerCase().replace(/[^a-z0-9-]+/g, join).replace(/-+/g, join).split(join).filter(Boolean).join(join);
};
const second = 1 * 1e3;
const minute = second * 60;
const hour = minute * 60;
const day = hour * 24;
/**
* A collection of periods in milliseconds and their suffixes used when creating
* time strings.
*/
const periods = [
	["w", day * 7],
	["d", day],
	["h", hour],
	["m", minute],
	["s", second]
];
/**
* Convert a given `Date`, `number`, or `ms`-compatible `string` to a
* Inngest sleep-compatible time string (e.g. `"1d"` or `"2h3010s"`).
*
* Can optionally provide a `now` date to use as the base for the calculation,
* otherwise a new date will be created on invocation.
*/
const timeStr = (input) => {
	if (input instanceof Date) return input.toISOString();
	const milliseconds = typeof input === "string" ? (0, ms.default)(input) : input;
	const [, timeStr$1] = periods.reduce(([num, str], [suffix, period]) => {
		const numPeriods = Math.floor(num / period);
		if (numPeriods > 0) return [num % period, `${str}${numPeriods}${suffix}`];
		return [num, str];
	}, [milliseconds, ""]);
	return timeStr$1;
};
/**
* Given an unknown input, stringify it if it's a boolean, a number, or a
* string, else return `undefined`.
*/
const stringifyUnknown = (input) => {
	if (typeof input === "boolean" || typeof input === "number" || typeof input === "string") return input.toString();
};
const hashEventKey = (eventKey) => {
	return sha256().update(eventKey).digest("hex");
};
const hashSigningKey = (signingKey) => {
	if (!signingKey) return "";
	const prefix = signingKey.match(/^signkey-[\w]+-/)?.shift() || "";
	const key = signingKey.replace(/^signkey-[\w]+-/, "");
	return `${prefix}${sha256().update(key, "hex").digest("hex")}`;
};

//#endregion
exports.hashEventKey = hashEventKey;
exports.hashSigningKey = hashSigningKey;
exports.slugify = slugify;
exports.stringify = stringify;
exports.stringifyUnknown = stringifyUnknown;
exports.timeStr = timeStr;
//# sourceMappingURL=strings.cjs.map