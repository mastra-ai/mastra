import { __export } from "./_virtual/rolldown_runtime.js";
import { z } from "zod/v3";

//#region src/types.ts
var types_exports = /* @__PURE__ */ __export({
	StepOpCode: () => StepOpCode,
	err: () => err,
	functionConfigSchema: () => functionConfigSchema,
	inBandSyncRequestBodySchema: () => inBandSyncRequestBodySchema,
	incomingOpSchema: () => incomingOpSchema,
	jsonErrorSchema: () => jsonErrorSchema,
	logLevels: () => logLevels,
	ok: () => ok,
	sendEventResponseSchema: () => sendEventResponseSchema
});
const baseJsonErrorSchema = z.object({
	name: z.string().trim().optional(),
	error: z.string().trim().optional(),
	message: z.string().trim().optional(),
	stack: z.string().trim().optional()
});
const maybeJsonErrorSchema = z.lazy(() => z.object({
	name: z.string().trim(),
	message: z.string().trim(),
	stack: z.string().trim().optional(),
	cause: z.union([maybeJsonErrorSchema, z.unknown()]).optional()
}));
const jsonErrorSchema = baseJsonErrorSchema.extend({ cause: z.union([maybeJsonErrorSchema, z.unknown()]).optional() }).passthrough().catch({}).transform((val) => {
	return {
		...val,
		name: val.name || "Error",
		message: val.message || val.error || "Unknown error",
		stack: val.stack
	};
});
/**
* Unique codes for the different types of operation that can be sent to Inngest
* from SDK step functions.
*/
let StepOpCode = /* @__PURE__ */ function(StepOpCode$1) {
	StepOpCode$1["WaitForSignal"] = "WaitForSignal";
	StepOpCode$1["WaitForEvent"] = "WaitForEvent";
	/**
	* Legacy equivalent to `"StepRun"`. Has mixed data wrapping (e.g. `data` or
	* `data.data` depending on SDK version), so this is phased out in favour of
	* `"StepRun"`, which never wraps.
	*
	* Note that it is still used for v0 executions for backwards compatibility.
	*
	* @deprecated Only used for v0 executions; use `"StepRun"` instead.
	*/
	StepOpCode$1["Step"] = "Step";
	StepOpCode$1["StepRun"] = "StepRun";
	StepOpCode$1["StepError"] = "StepError";
	StepOpCode$1["StepFailed"] = "StepFailed";
	StepOpCode$1["StepPlanned"] = "StepPlanned";
	StepOpCode$1["Sleep"] = "Sleep";
	/**
	* Used to signify that the executor has requested that a step run, but we
	* could not find that step.
	*
	* This is likely indicative that a step was renamed or removed from the
	* function.
	*/
	StepOpCode$1["StepNotFound"] = "StepNotFound";
	StepOpCode$1["InvokeFunction"] = "InvokeFunction";
	StepOpCode$1["AiGateway"] = "AIGateway";
	StepOpCode$1["Gateway"] = "Gateway";
	return StepOpCode$1;
}({});
const incomingOpSchema = z.object({
	id: z.string().min(1),
	data: z.any().optional(),
	error: z.any().optional(),
	input: z.any().optional()
});
const sendEventResponseSchema = z.object({
	ids: z.array(z.string()).default([]),
	status: z.number().default(0),
	error: z.string().optional()
});
/**
* A set of log levels that can be used to control the amount of logging output
* from various parts of the Inngest library.
*
* @public
*/
const logLevels = [
	"fatal",
	"error",
	"warn",
	"info",
	"debug",
	"silent"
];
/**
* This schema is used internally to share the shape of a concurrency option
* when validating config. We cannot add comments to Zod fields, so we just use
* an extra type check to ensure it matches our exported expectations.
*/
const concurrencyOptionSchema = z.strictObject({
	limit: z.number(),
	key: z.string().optional(),
	scope: z.enum([
		"fn",
		"env",
		"account"
	]).optional()
});
/**
* The schema used to represent an individual function being synced with
* Inngest.
*
* Note that this should only be used to validate the shape of a config object
* and not used for feature compatibility, such as feature X being exclusive
* with feature Y; these should be handled on the Inngest side.
*/
const functionConfigSchema = z.strictObject({
	name: z.string().optional(),
	id: z.string(),
	triggers: z.array(z.union([z.strictObject({
		event: z.string(),
		expression: z.string().optional()
	}), z.strictObject({ cron: z.string() })])),
	steps: z.record(z.strictObject({
		id: z.string(),
		name: z.string(),
		runtime: z.strictObject({
			type: z.union([z.literal("http"), z.literal("ws")]),
			url: z.string()
		}),
		retries: z.strictObject({ attempts: z.number().optional() }).optional()
	})),
	idempotency: z.string().optional(),
	batchEvents: z.strictObject({
		maxSize: z.number(),
		timeout: z.string(),
		key: z.string().optional(),
		if: z.string().optional()
	}).optional(),
	rateLimit: z.strictObject({
		key: z.string().optional(),
		limit: z.number(),
		period: z.string().transform((x) => x)
	}).optional(),
	throttle: z.strictObject({
		key: z.string().optional(),
		limit: z.number(),
		period: z.string().transform((x) => x),
		burst: z.number().optional()
	}).optional(),
	singleton: z.strictObject({
		key: z.string().optional(),
		mode: z.enum(["skip", "cancel"])
	}).optional(),
	cancel: z.array(z.strictObject({
		event: z.string(),
		if: z.string().optional(),
		timeout: z.string().optional()
	})).optional(),
	debounce: z.strictObject({
		key: z.string().optional(),
		period: z.string().transform((x) => x),
		timeout: z.string().transform((x) => x).optional()
	}).optional(),
	timeouts: z.strictObject({
		start: z.string().transform((x) => x).optional(),
		finish: z.string().transform((x) => x).optional()
	}).optional(),
	priority: z.strictObject({ run: z.string().optional() }).optional(),
	concurrency: z.union([
		z.number(),
		concurrencyOptionSchema.transform((x) => x),
		z.array(concurrencyOptionSchema.transform((x) => x)).min(1).max(2)
	]).optional()
});
const ok = (data) => {
	return {
		ok: true,
		value: data
	};
};
const err = (error) => {
	return {
		ok: false,
		error
	};
};
const inBandSyncRequestBodySchema = z.strictObject({ url: z.string() });

//#endregion
export { StepOpCode, err, functionConfigSchema, inBandSyncRequestBodySchema, incomingOpSchema, jsonErrorSchema, logLevels, ok, sendEventResponseSchema, types_exports };
//# sourceMappingURL=types.js.map