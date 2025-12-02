
//#region src/components/NonRetriableError.ts
/**
* An error that, when thrown, indicates to Inngest that the function should
* cease all execution and not retry.
*
* A `message` must be provided, and an optional `cause` can be provided to
* provide more context to the error.
*
* @public
*/
var NonRetriableError = class extends Error {
	/**
	* The underlying cause of the error, if any.
	*
	* This will be serialized and sent to Inngest.
	*/
	cause;
	constructor(message, options) {
		super(message);
		this.cause = options?.cause;
		this.name = "NonRetriableError";
	}
};

//#endregion
exports.NonRetriableError = NonRetriableError;
//# sourceMappingURL=NonRetriableError.cjs.map