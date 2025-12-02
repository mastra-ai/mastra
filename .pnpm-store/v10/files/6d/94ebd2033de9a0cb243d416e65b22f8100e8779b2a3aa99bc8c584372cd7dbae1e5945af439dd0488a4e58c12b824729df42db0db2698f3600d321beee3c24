//#region src/helpers/temporal.ts
/**
* Asserts that the given `input` is a `Temporal.Duration` object.
*/
const isTemporalDuration = (input) => {
	try {
		return input[Symbol.toStringTag] === "Temporal.Duration";
	} catch {
		return false;
	}
};
/**
* Asserts that the given `input` is a `Temporal.TimeZone` object.
*/
const isTemporalInstant = (input) => {
	try {
		return input[Symbol.toStringTag] === "Temporal.Instant";
	} catch {
		return false;
	}
};
/**
* Asserts that the given `input` is a `Temporal.ZonedDateTime` object.
*/
const isTemporalZonedDateTime = (input) => {
	try {
		return input[Symbol.toStringTag] === "Temporal.ZonedDateTime";
	} catch {
		return false;
	}
};
/**
* Converts a given `Date`, `string`, `Temporal.Instant`, or
* `Temporal.ZonedDateTime` to an ISO 8601 string.
*/
const getISOString = (time) => {
	if (typeof time === "string") return new Date(time).toISOString();
	if (time instanceof Date) return time.toISOString();
	if (isTemporalZonedDateTime(time)) return time.toInstant().toString();
	if (isTemporalInstant(time)) return time.toString();
	throw new TypeError("Invalid date input");
};

//#endregion
export { getISOString, isTemporalDuration };
//# sourceMappingURL=temporal.js.map