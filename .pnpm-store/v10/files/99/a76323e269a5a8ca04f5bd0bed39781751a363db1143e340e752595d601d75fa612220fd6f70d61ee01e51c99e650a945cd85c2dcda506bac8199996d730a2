const require_errors = require('../helpers/errors.cjs');
const require_types = require('../types.cjs');

//#region src/components/StepError.ts
/**
* An error that represents a step exhausting all retries and failing. This is
* thrown by an Inngest step if it fails.
*
* It's synonymous with an `Error`, with the addition of the `stepId` that
* failed.
*
* @public
*/
var StepError = class extends Error {
	cause;
	constructor(stepId, err) {
		const parsedErr = require_types.jsonErrorSchema.parse(err);
		super(parsedErr.message);
		this.stepId = stepId;
		this.name = parsedErr.name;
		this.stepId = stepId;
		this.stack = parsedErr.stack ?? void 0;
		this.cause = parsedErr.cause ? require_errors.deserializeError(parsedErr.cause, true) : void 0;
	}
};

//#endregion
exports.StepError = StepError;
//# sourceMappingURL=StepError.cjs.map