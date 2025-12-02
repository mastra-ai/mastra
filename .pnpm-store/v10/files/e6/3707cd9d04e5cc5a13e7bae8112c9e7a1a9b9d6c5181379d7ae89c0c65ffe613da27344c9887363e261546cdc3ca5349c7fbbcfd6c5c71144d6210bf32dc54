const require_rolldown_runtime = require('../_virtual/rolldown_runtime.cjs');
const require_consts = require('../helpers/consts.cjs');
const require_strings = require('../helpers/strings.cjs');
const require_types = require('../types.cjs');
const require_temporal = require('../helpers/temporal.cjs');
const require_InngestFunction = require('./InngestFunction.cjs');
const require_InngestFunctionReference = require('./InngestFunctionReference.cjs');
const require_Fetch = require('./Fetch.cjs');
let zod_v3 = require("zod/v3");
zod_v3 = require_rolldown_runtime.__toESM(zod_v3);
let __inngest_ai = require("@inngest/ai");
__inngest_ai = require_rolldown_runtime.__toESM(__inngest_ai);

//#region src/components/InngestStepTools.ts
const getStepOptions = (options) => {
	if (typeof options === "string") return { id: options };
	return options;
};
/**
* Suffix used to namespace steps that are automatically indexed.
*/
const STEP_INDEXING_SUFFIX = ":";
/**
* Create a new set of step function tools ready to be used in a step function.
* This function should be run and a fresh set of tools provided every time a
* function is run.
*
* An op stack (function state) is passed in as well as some mutable properties
* that the tools can use to submit a new op.
*/
const createStepTools = (client, execution, stepHandler) => {
	/**
	* A local helper used to create tools that can be used to submit an op.
	*
	* When using this function, a generic type should be provided which is the
	* function signature exposed to the user.
	*/
	const createTool = (matchOp, opts) => {
		return (async (...args) => {
			return stepHandler({
				args,
				matchOp,
				opts
			});
		});
	};
	/**
	* Create a new step run tool that can be used to run a step function using
	* `step.run()` as a shim.
	*/
	const createStepRun = (type) => {
		return createTool(({ id, name }, _fn, ...input) => {
			const opts = {
				...input.length ? { input } : {},
				...type ? { type } : {}
			};
			return {
				id,
				op: require_types.StepOpCode.StepPlanned,
				name: id,
				displayName: name ?? id,
				...Object.keys(opts).length ? { opts } : {}
			};
		}, { fn: (_, fn, ...input) => fn(...input) });
	};
	/**
	* Define the set of tools the user has access to for their step functions.
	*
	* Each key is the function name and is expected to run `createTool` and pass
	* a generic type for that function as it will appear in the user's code.
	*/
	const tools = {
		sendEvent: createTool(({ id, name }) => {
			return {
				id,
				op: require_types.StepOpCode.StepPlanned,
				name: "sendEvent",
				displayName: name ?? id,
				opts: { type: "step.sendEvent" }
			};
		}, { fn: (_idOrOptions, payload) => {
			return client["_send"]({
				payload,
				headers: execution["options"]["headers"]
			});
		} }),
		waitForSignal: createTool(({ id, name }, opts) => {
			return {
				id,
				op: require_types.StepOpCode.WaitForSignal,
				name: opts.signal,
				displayName: name ?? id,
				opts: {
					signal: opts.signal,
					timeout: require_strings.timeStr(opts.timeout),
					conflict: opts.onConflict
				}
			};
		}),
		sendSignal: createTool(({ id, name }, opts) => {
			return {
				id,
				op: require_types.StepOpCode.StepPlanned,
				name: "sendSignal",
				displayName: name ?? id,
				opts: {
					type: "step.sendSignal",
					signal: opts.signal
				}
			};
		}, { fn: (_idOrOptions, opts) => {
			return client["_sendSignal"]({
				signal: opts.signal,
				data: opts.data,
				headers: execution["options"]["headers"]
			});
		} }),
		waitForEvent: createTool(({ id, name }, opts) => {
			const matchOpts = { timeout: require_strings.timeStr(typeof opts === "string" ? opts : opts.timeout) };
			if (typeof opts !== "string") {
				if (opts?.match) matchOpts.if = `event.${opts.match} == async.${opts.match}`;
				else if (opts?.if) matchOpts.if = opts.if;
			}
			return {
				id,
				op: require_types.StepOpCode.WaitForEvent,
				name: opts.event,
				opts: matchOpts,
				displayName: name ?? id
			};
		}),
		run: createStepRun(),
		ai: {
			infer: createTool(({ id, name }, options) => {
				const { model, body,...rest } = options;
				const modelCopy = { ...model };
				options.model.onCall?.(modelCopy, options.body);
				return {
					id,
					op: require_types.StepOpCode.AiGateway,
					displayName: name ?? id,
					opts: {
						type: "step.ai.infer",
						url: modelCopy.url,
						headers: modelCopy.headers,
						auth_key: modelCopy.authKey,
						format: modelCopy.format,
						body,
						...rest
					}
				};
			}),
			wrap: createStepRun("step.ai.wrap"),
			models: { ...__inngest_ai.models }
		},
		sleep: createTool(({ id, name }, time) => {
			/**
			* The presence of this operation in the returned stack indicates that the
			* sleep is over and we should continue execution.
			*/
			const msTimeStr = require_strings.timeStr(require_temporal.isTemporalDuration(time) ? time.total({ unit: "milliseconds" }) : time);
			return {
				id,
				op: require_types.StepOpCode.Sleep,
				name: msTimeStr,
				displayName: name ?? id
			};
		}),
		sleepUntil: createTool(({ id, name }, time) => {
			try {
				const iso = require_temporal.getISOString(time);
				/**
				* The presence of this operation in the returned stack indicates that the
				* sleep is over and we should continue execution.
				*/
				return {
					id,
					op: require_types.StepOpCode.Sleep,
					name: iso,
					displayName: name ?? id
				};
			} catch (err) {
				/**
				* If we're here, it's because the date is invalid. We'll throw a custom
				* error here to standardise this response.
				*/
				console.warn("Invalid `Date`, date string, `Temporal.Instant`, or `Temporal.ZonedDateTime` passed to sleepUntil;", err);
				throw new Error(`Invalid \`Date\`, date string, \`Temporal.Instant\`, or \`Temporal.ZonedDateTime\` passed to sleepUntil: ${time}`);
			}
		}),
		invoke: createTool(({ id, name }, invokeOpts) => {
			const optsSchema = invokePayloadSchema.extend({ timeout: zod_v3.z.union([
				zod_v3.z.number(),
				zod_v3.z.string(),
				zod_v3.z.date()
			]).optional() });
			const parsedFnOpts = optsSchema.extend({
				_type: zod_v3.z.literal("fullId").optional().default("fullId"),
				function: zod_v3.z.string().min(1)
			}).or(optsSchema.extend({
				_type: zod_v3.z.literal("fnInstance").optional().default("fnInstance"),
				function: zod_v3.z.instanceof(require_InngestFunction.InngestFunction)
			})).or(optsSchema.extend({
				_type: zod_v3.z.literal("refInstance").optional().default("refInstance"),
				function: zod_v3.z.instanceof(require_InngestFunctionReference.InngestFunctionReference)
			})).safeParse(invokeOpts);
			if (!parsedFnOpts.success) throw new Error(`Invalid invocation options passed to invoke; must include either a function or functionId.`);
			const { _type, function: fn, data, user, v, timeout } = parsedFnOpts.data;
			const opts = {
				payload: {
					data,
					user,
					v
				},
				function_id: "",
				timeout: typeof timeout === "undefined" ? void 0 : require_strings.timeStr(timeout)
			};
			switch (_type) {
				case "fnInstance":
					opts.function_id = fn.id(fn["client"].id);
					break;
				case "fullId":
					console.warn(`${require_consts.logPrefix} Invoking function with \`function: string\` is deprecated and will be removed in v4.0.0; use an imported function or \`referenceFunction()\` instead. See https://innge.st/ts-referencing-functions`);
					opts.function_id = fn;
					break;
				case "refInstance":
					opts.function_id = [fn.opts.appId || client.id, fn.opts.functionId].filter(Boolean).join("-");
					break;
			}
			return {
				id,
				op: require_types.StepOpCode.InvokeFunction,
				displayName: name ?? id,
				opts
			};
		}),
		fetch: require_Fetch.fetch
	};
	tools[gatewaySymbol] = createTool(({ id, name }, input, init) => {
		const url = input instanceof Request ? input.url : input.toString();
		const headers = {};
		if (input instanceof Request) input.headers.forEach((value, key) => {
			headers[key] = value;
		});
		else if (init?.headers) new Headers(init.headers).forEach((value, key) => {
			headers[key] = value;
		});
		return {
			id,
			op: require_types.StepOpCode.Gateway,
			displayName: name ?? id,
			opts: {
				url,
				method: init?.method ?? "GET",
				headers,
				body: init?.body
			}
		};
	});
	return tools;
};
const gatewaySymbol = Symbol.for("inngest.step.gateway");
/**
* The event payload portion of the options for `step.invoke()`. This does not
* include non-payload options like `timeout` or the function to invoke.
*/
const invokePayloadSchema = zod_v3.z.object({
	data: zod_v3.z.record(zod_v3.z.any()).optional(),
	user: zod_v3.z.record(zod_v3.z.any()).optional(),
	v: zod_v3.z.string().optional()
});

//#endregion
exports.STEP_INDEXING_SUFFIX = STEP_INDEXING_SUFFIX;
exports.createStepTools = createStepTools;
exports.gatewaySymbol = gatewaySymbol;
exports.getStepOptions = getStepOptions;
exports.invokePayloadSchema = invokePayloadSchema;
//# sourceMappingURL=InngestStepTools.cjs.map