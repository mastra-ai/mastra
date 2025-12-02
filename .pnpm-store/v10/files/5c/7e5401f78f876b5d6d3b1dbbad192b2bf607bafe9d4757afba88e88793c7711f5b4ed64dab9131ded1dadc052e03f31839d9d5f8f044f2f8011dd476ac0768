import { deserializeError } from "../helpers/errors.js";
import { jsonErrorSchema } from "../types.js";

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
		const parsedErr = jsonErrorSchema.parse(err);
		super(parsedErr.message);
		this.stepId = stepId;
		this.name = parsedErr.name;
		this.stepId = stepId;
		this.stack = parsedErr.stack ?? void 0;
		this.cause = parsedErr.cause ? deserializeError(parsedErr.cause, true) : void 0;
	}
};

//#endregion
export { StepError };
//# sourceMappingURL=StepError.js.map