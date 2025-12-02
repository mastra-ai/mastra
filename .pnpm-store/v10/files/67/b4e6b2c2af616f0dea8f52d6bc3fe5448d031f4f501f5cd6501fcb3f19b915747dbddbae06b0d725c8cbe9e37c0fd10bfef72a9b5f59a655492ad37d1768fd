import hashjs from "hash.js";
import stringify from "json-stringify-safe";
import ms from "ms";

//#region src/helpers/strings.ts
const { sha256 } = hashjs;
/**
* Safely `JSON.stringify()` an `input`, handling circular refernences and
* removing `BigInt` values.
*/
const stringify$1 = (input) => {
	return stringify(input, (_key, value) => {
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
	const milliseconds = typeof input === "string" ? ms(input) : input;
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
export { hashEventKey, hashSigningKey, slugify, stringify$1 as stringify, stringifyUnknown, timeStr };
//# sourceMappingURL=strings.js.map