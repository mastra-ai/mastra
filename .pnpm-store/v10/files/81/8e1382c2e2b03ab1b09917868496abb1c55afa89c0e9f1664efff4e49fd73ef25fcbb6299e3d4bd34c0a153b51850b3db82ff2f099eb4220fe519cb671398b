import ms from "ms";

//#region src/components/RetryAfterError.ts
/**
* An error that, when thrown, indicates to Inngest that the function should be
* retried after a given amount of time.
*
* A `message` must be provided, as well as a `retryAfter` parameter, which can
* be a `number` of milliseconds, an `ms`-compatible time string, or a `Date`.
*
* An optional `cause` can be provided to provide more context to the error.
*
* @public
*/
var RetryAfterError = class extends Error {
	/**
	* The underlying cause of the error, if any.
	*
	* This will be serialized and sent to Inngest.
	*/
	cause;
	/**
	* The time after which the function should be retried. Represents either a
	* number of milliseconds or a RFC3339 date.
	*/
	retryAfter;
	constructor(message, retryAfter, options) {
		super(message);
		if (retryAfter instanceof Date) this.retryAfter = retryAfter.toISOString();
		else {
			const seconds = `${Math.ceil((typeof retryAfter === "string" ? ms(retryAfter) : retryAfter) / 1e3)}`;
			if (!isFinite(Number(seconds))) throw new Error("retryAfter must be a number of milliseconds, a ms-compatible string, or a Date");
			this.retryAfter = seconds;
		}
		this.cause = options?.cause;
	}
};

//#endregion
export { RetryAfterError };
//# sourceMappingURL=RetryAfterError.js.map