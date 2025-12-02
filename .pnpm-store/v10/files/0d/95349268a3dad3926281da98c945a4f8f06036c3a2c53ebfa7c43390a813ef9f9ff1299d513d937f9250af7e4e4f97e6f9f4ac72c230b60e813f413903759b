const require_rolldown_runtime = require('./_virtual/rolldown_runtime.cjs');
let zod_v3 = require("zod/v3");
zod_v3 = require_rolldown_runtime.__toESM(zod_v3);

//#region src/types.ts
var types_exports = /* @__PURE__ */ require_rolldown_runtime.__export({
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
const baseJsonErrorSchema = zod_v3.z.object({
	name: zod_v3.z.string().trim().optional(),
	error: zod_v3.z.string().trim().optional(),
	message: zod_v3.z.string().trim().optional(),
	stack: zod_v3.z.string().trim().optional()
});
const maybeJsonErrorSchema = zod_v3.z.lazy(() => zod_v3.z.object({
	name: zod_v3.z.string().trim(),
	message: zod_v3.z.string().trim(),
	stack: zod_v3.z.string().trim().optional(),
	cause: zod_v3.z.union([maybeJsonErrorSchema, zod_v3.z.unknown()]).optional()
}));
const jsonErrorSchema = baseJsonErrorSchema.extend({ cause: zod_v3.z.union([maybeJsonErrorSchema, zod_v3.z.unknown()]).optional() }).passthrough().catch({}).transform((val) => {
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
const incomingOpSchema = zod_v3.z.object({
	id: zod_v3.z.string().min(1),
	data: zod_v3.z.any().optional(),
	error: zod_v3.z.any().optional(),
	input: zod_v3.z.any().optional()
});
const sendEventResponseSchema = zod_v3.z.object({
	ids: zod_v3.z.array(zod_v3.z.string()).default([]),
	status: zod_v3.z.number().default(0),
	error: zod_v3.z.string().optional()
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
const concurrencyOptionSchema = zod_v3.z.strictObject({
	limit: zod_v3.z.number(),
	key: zod_v3.z.string().optional(),
	scope: zod_v3.z.enum([
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
const functionConfigSchema = zod_v3.z.strictObject({
	name: zod_v3.z.string().optional(),
	id: zod_v3.z.string(),
	triggers: zod_v3.z.array(zod_v3.z.union([zod_v3.z.strictObject({
		event: zod_v3.z.string(),
		expression: zod_v3.z.string().optional()
	}), zod_v3.z.strictObject({ cron: zod_v3.z.string() })])),
	steps: zod_v3.z.record(zod_v3.z.strictObject({
		id: zod_v3.z.string(),
		name: zod_v3.z.string(),
		runtime: zod_v3.z.strictObject({
			type: zod_v3.z.union([zod_v3.z.literal("http"), zod_v3.z.literal("ws")]),
			url: zod_v3.z.string()
		}),
		retries: zod_v3.z.strictObject({ attempts: zod_v3.z.number().optional() }).optional()
	})),
	idempotency: zod_v3.z.string().optional(),
	batchEvents: zod_v3.z.strictObject({
		maxSize: zod_v3.z.number(),
		timeout: zod_v3.z.string(),
		key: zod_v3.z.string().optional(),
		if: zod_v3.z.string().optional()
	}).optional(),
	rateLimit: zod_v3.z.strictObject({
		key: zod_v3.z.string().optional(),
		limit: zod_v3.z.number(),
		period: zod_v3.z.string().transform((x) => x)
	}).optional(),
	throttle: zod_v3.z.strictObject({
		key: zod_v3.z.string().optional(),
		limit: zod_v3.z.number(),
		period: zod_v3.z.string().transform((x) => x),
		burst: zod_v3.z.number().optional()
	}).optional(),
	singleton: zod_v3.z.strictObject({
		key: zod_v3.z.string().optional(),
		mode: zod_v3.z.enum(["skip", "cancel"])
	}).optional(),
	cancel: zod_v3.z.array(zod_v3.z.strictObject({
		event: zod_v3.z.string(),
		if: zod_v3.z.string().optional(),
		timeout: zod_v3.z.string().optional()
	})).optional(),
	debounce: zod_v3.z.strictObject({
		key: zod_v3.z.string().optional(),
		period: zod_v3.z.string().transform((x) => x),
		timeout: zod_v3.z.string().transform((x) => x).optional()
	}).optional(),
	timeouts: zod_v3.z.strictObject({
		start: zod_v3.z.string().transform((x) => x).optional(),
		finish: zod_v3.z.string().transform((x) => x).optional()
	}).optional(),
	priority: zod_v3.z.strictObject({ run: zod_v3.z.string().optional() }).optional(),
	concurrency: zod_v3.z.union([
		zod_v3.z.number(),
		concurrencyOptionSchema.transform((x) => x),
		zod_v3.z.array(concurrencyOptionSchema.transform((x) => x)).min(1).max(2)
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
const inBandSyncRequestBodySchema = zod_v3.z.strictObject({ url: zod_v3.z.string() });

//#endregion
exports.StepOpCode = StepOpCode;
exports.err = err;
exports.functionConfigSchema = functionConfigSchema;
exports.inBandSyncRequestBodySchema = inBandSyncRequestBodySchema;
exports.incomingOpSchema = incomingOpSchema;
exports.jsonErrorSchema = jsonErrorSchema;
exports.logLevels = logLevels;
exports.ok = ok;
exports.sendEventResponseSchema = sendEventResponseSchema;
Object.defineProperty(exports, 'types_exports', {
  enumerable: true,
  get: function () {
    return types_exports;
  }
});
//# sourceMappingURL=types.cjs.map