const require_rolldown_runtime = require('../_virtual/rolldown_runtime.cjs');
const require_consts = require('./consts.cjs');
const require_errors = require('./errors.cjs');
const require_types = require('../types.cjs');
const require_schema = require('../api/schema.cjs');
const require_InngestExecution = require('../components/execution/InngestExecution.cjs');
let zod_v3 = require("zod/v3");
zod_v3 = require_rolldown_runtime.__toESM(zod_v3);

//#region src/helpers/functions.ts
/**
* Wraps a function with a cache. When the returned function is run, it will
* cache the result and return it on subsequent calls.
*/
const cacheFn = (fn) => {
	const key = "value";
	const cache = /* @__PURE__ */ new Map();
	return ((...args) => {
		if (!cache.has(key)) cache.set(key, fn(...args));
		return cache.get(key);
	});
};
/**
* Given an array of functions, return a new function that will run each
* function in series and return the result of the final function. Regardless of
* if the functions are synchronous or asynchronous, they'll be made into an
* async promise chain.
*
* If an error is thrown, the waterfall will stop and return the error.
*
* Because this needs to support both sync and async functions, it only allows
* functions that accept a single argument.
*/
const waterfall = (fns, transform) => {
	return (...args) => {
		return fns.reduce(async (acc, fn) => {
			const prev = await acc;
			const output = await fn(prev);
			if (transform) return await transform(prev, output);
			if (typeof output === "undefined") return prev;
			return output;
		}, Promise.resolve(args[0]));
	};
};
/**
* Given a value `v`, return `v` if it's not undefined, otherwise return `null`.
*/
const undefinedToNull = (v) => {
	return typeof v === "undefined" ? null : v;
};
const fnDataVersionSchema = zod_v3.z.object({ version: zod_v3.z.literal(-1).or(zod_v3.z.literal(0)).or(zod_v3.z.literal(1)).or(zod_v3.z.literal(2)).optional().transform((v) => {
	if (typeof v === "undefined") {
		console.debug(`No request version specified by executor; defaulting to v${require_InngestExecution.PREFERRED_EXECUTION_VERSION}`);
		return require_InngestExecution.PREFERRED_EXECUTION_VERSION;
	}
	return v === -1 ? require_InngestExecution.PREFERRED_EXECUTION_VERSION : v;
}) });
const parseFnData = (data) => {
	let version;
	try {
		({version} = fnDataVersionSchema.parse(data));
		return {
			[require_consts.ExecutionVersion.V0]: () => ({
				version: require_consts.ExecutionVersion.V0,
				...zod_v3.z.object({
					event: zod_v3.z.record(zod_v3.z.any()),
					events: zod_v3.z.array(zod_v3.z.record(zod_v3.z.any())).default([]),
					steps: require_schema.stepsSchemas[require_consts.ExecutionVersion.V0],
					ctx: zod_v3.z.object({
						run_id: zod_v3.z.string(),
						attempt: zod_v3.z.number().default(0),
						stack: zod_v3.z.object({
							stack: zod_v3.z.array(zod_v3.z.string()).nullable().transform((v) => Array.isArray(v) ? v : []),
							current: zod_v3.z.number()
						}).passthrough().optional().nullable()
					}).optional().nullable(),
					use_api: zod_v3.z.boolean().default(false)
				}).parse(data)
			}),
			[require_consts.ExecutionVersion.V1]: () => ({
				version: require_consts.ExecutionVersion.V1,
				...zod_v3.z.object({
					event: zod_v3.z.record(zod_v3.z.any()),
					events: zod_v3.z.array(zod_v3.z.record(zod_v3.z.any())).default([]),
					steps: require_schema.stepsSchemas[require_consts.ExecutionVersion.V1],
					ctx: zod_v3.z.object({
						run_id: zod_v3.z.string(),
						attempt: zod_v3.z.number().default(0),
						max_attempts: zod_v3.z.number().optional(),
						disable_immediate_execution: zod_v3.z.boolean().default(false),
						use_api: zod_v3.z.boolean().default(false),
						stack: zod_v3.z.object({
							stack: zod_v3.z.array(zod_v3.z.string()).nullable().transform((v) => Array.isArray(v) ? v : []),
							current: zod_v3.z.number()
						}).passthrough().optional().nullable()
					}).optional().nullable()
				}).parse(data)
			}),
			[require_consts.ExecutionVersion.V2]: () => ({
				version: require_consts.ExecutionVersion.V2,
				...zod_v3.z.object({
					event: zod_v3.z.record(zod_v3.z.any()),
					events: zod_v3.z.array(zod_v3.z.record(zod_v3.z.any())).default([]),
					steps: require_schema.stepsSchemas[require_consts.ExecutionVersion.V2],
					ctx: zod_v3.z.object({
						run_id: zod_v3.z.string(),
						attempt: zod_v3.z.number().default(0),
						max_attempts: zod_v3.z.number().optional(),
						disable_immediate_execution: zod_v3.z.boolean().default(false),
						use_api: zod_v3.z.boolean().default(false),
						stack: zod_v3.z.object({
							stack: zod_v3.z.array(zod_v3.z.string()).nullable().transform((v) => Array.isArray(v) ? v : []),
							current: zod_v3.z.number()
						}).passthrough().optional().nullable()
					}).optional().nullable()
				}).parse(data)
			})
		}[version]();
	} catch (err$1) {
		throw new Error(parseFailureErr(err$1));
	}
};
const fetchAllFnData = async ({ data, api, version }) => {
	const result = { ...data };
	try {
		if (result.version === require_consts.ExecutionVersion.V0 && result.use_api || result.version === require_consts.ExecutionVersion.V1 && result.ctx?.use_api) {
			if (!result.ctx?.run_id) return require_types.err(require_errors.prettyError({
				whatHappened: "failed to attempt retrieving data from API",
				consequences: "function execution can't continue",
				why: "run_id is missing from context",
				stack: true
			}));
			const [evtResp, stepResp] = await Promise.all([api.getRunBatch(result.ctx.run_id), api.getRunSteps(result.ctx.run_id, version)]);
			if (evtResp.ok) result.events = evtResp.value;
			else return require_types.err(require_errors.prettyError({
				whatHappened: "failed to retrieve list of events",
				consequences: "function execution can't continue",
				why: evtResp.error?.error,
				stack: true
			}));
			if (stepResp.ok) result.steps = stepResp.value;
			else return require_types.err(require_errors.prettyError({
				whatHappened: "failed to retrieve steps for function run",
				consequences: "function execution can't continue",
				why: stepResp.error?.error,
				stack: true
			}));
		}
		return require_types.ok(result);
	} catch (error) {
		console.error(error);
		return require_types.err(parseFailureErr(error));
	}
};
const parseFailureErr = (err$1) => {
	let why;
	if (err$1 instanceof zod_v3.ZodError) why = err$1.toString();
	return require_errors.prettyError({
		whatHappened: "Failed to parse data from executor.",
		consequences: "Function execution can't continue.",
		toFixNow: "Make sure that your API is set up to parse incoming request bodies as JSON, like body-parser for Express (https://expressjs.com/en/resources/middleware/body-parser.html).",
		stack: true,
		why
	});
};

//#endregion
exports.cacheFn = cacheFn;
exports.fetchAllFnData = fetchAllFnData;
exports.parseFnData = parseFnData;
exports.undefinedToNull = undefinedToNull;
exports.waterfall = waterfall;
//# sourceMappingURL=functions.cjs.map