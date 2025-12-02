import { ExecutionVersion } from "./consts.js";
import { prettyError } from "./errors.js";
import { err, ok } from "../types.js";
import { stepsSchemas } from "../api/schema.js";
import { PREFERRED_EXECUTION_VERSION } from "../components/execution/InngestExecution.js";
import { ZodError, z } from "zod/v3";

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
const fnDataVersionSchema = z.object({ version: z.literal(-1).or(z.literal(0)).or(z.literal(1)).or(z.literal(2)).optional().transform((v) => {
	if (typeof v === "undefined") {
		console.debug(`No request version specified by executor; defaulting to v${PREFERRED_EXECUTION_VERSION}`);
		return PREFERRED_EXECUTION_VERSION;
	}
	return v === -1 ? PREFERRED_EXECUTION_VERSION : v;
}) });
const parseFnData = (data) => {
	let version;
	try {
		({version} = fnDataVersionSchema.parse(data));
		return {
			[ExecutionVersion.V0]: () => ({
				version: ExecutionVersion.V0,
				...z.object({
					event: z.record(z.any()),
					events: z.array(z.record(z.any())).default([]),
					steps: stepsSchemas[ExecutionVersion.V0],
					ctx: z.object({
						run_id: z.string(),
						attempt: z.number().default(0),
						stack: z.object({
							stack: z.array(z.string()).nullable().transform((v) => Array.isArray(v) ? v : []),
							current: z.number()
						}).passthrough().optional().nullable()
					}).optional().nullable(),
					use_api: z.boolean().default(false)
				}).parse(data)
			}),
			[ExecutionVersion.V1]: () => ({
				version: ExecutionVersion.V1,
				...z.object({
					event: z.record(z.any()),
					events: z.array(z.record(z.any())).default([]),
					steps: stepsSchemas[ExecutionVersion.V1],
					ctx: z.object({
						run_id: z.string(),
						attempt: z.number().default(0),
						max_attempts: z.number().optional(),
						disable_immediate_execution: z.boolean().default(false),
						use_api: z.boolean().default(false),
						stack: z.object({
							stack: z.array(z.string()).nullable().transform((v) => Array.isArray(v) ? v : []),
							current: z.number()
						}).passthrough().optional().nullable()
					}).optional().nullable()
				}).parse(data)
			}),
			[ExecutionVersion.V2]: () => ({
				version: ExecutionVersion.V2,
				...z.object({
					event: z.record(z.any()),
					events: z.array(z.record(z.any())).default([]),
					steps: stepsSchemas[ExecutionVersion.V2],
					ctx: z.object({
						run_id: z.string(),
						attempt: z.number().default(0),
						max_attempts: z.number().optional(),
						disable_immediate_execution: z.boolean().default(false),
						use_api: z.boolean().default(false),
						stack: z.object({
							stack: z.array(z.string()).nullable().transform((v) => Array.isArray(v) ? v : []),
							current: z.number()
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
		if (result.version === ExecutionVersion.V0 && result.use_api || result.version === ExecutionVersion.V1 && result.ctx?.use_api) {
			if (!result.ctx?.run_id) return err(prettyError({
				whatHappened: "failed to attempt retrieving data from API",
				consequences: "function execution can't continue",
				why: "run_id is missing from context",
				stack: true
			}));
			const [evtResp, stepResp] = await Promise.all([api.getRunBatch(result.ctx.run_id), api.getRunSteps(result.ctx.run_id, version)]);
			if (evtResp.ok) result.events = evtResp.value;
			else return err(prettyError({
				whatHappened: "failed to retrieve list of events",
				consequences: "function execution can't continue",
				why: evtResp.error?.error,
				stack: true
			}));
			if (stepResp.ok) result.steps = stepResp.value;
			else return err(prettyError({
				whatHappened: "failed to retrieve steps for function run",
				consequences: "function execution can't continue",
				why: stepResp.error?.error,
				stack: true
			}));
		}
		return ok(result);
	} catch (error) {
		console.error(error);
		return err(parseFailureErr(error));
	}
};
const parseFailureErr = (err$1) => {
	let why;
	if (err$1 instanceof ZodError) why = err$1.toString();
	return prettyError({
		whatHappened: "Failed to parse data from executor.",
		consequences: "Function execution can't continue.",
		toFixNow: "Make sure that your API is set up to parse incoming request bodies as JSON, like body-parser for Express (https://expressjs.com/en/resources/middleware/body-parser.html).",
		stack: true,
		why
	});
};

//#endregion
export { cacheFn, fetchAllFnData, parseFnData, undefinedToNull, waterfall };
//# sourceMappingURL=functions.js.map