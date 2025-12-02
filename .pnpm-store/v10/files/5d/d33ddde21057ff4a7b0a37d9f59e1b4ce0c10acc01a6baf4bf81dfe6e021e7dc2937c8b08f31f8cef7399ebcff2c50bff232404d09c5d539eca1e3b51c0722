import { logPrefix } from "../helpers/consts.js";
import { timeStr } from "../helpers/strings.js";
import { StepOpCode } from "../types.js";
import { getISOString, isTemporalDuration } from "../helpers/temporal.js";
import { InngestFunction } from "./InngestFunction.js";
import { InngestFunctionReference } from "./InngestFunctionReference.js";
import { fetch } from "./Fetch.js";
import { z } from "zod/v3";
import { models } from "@inngest/ai";

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
				op: StepOpCode.StepPlanned,
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
				op: StepOpCode.StepPlanned,
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
				op: StepOpCode.WaitForSignal,
				name: opts.signal,
				displayName: name ?? id,
				opts: {
					signal: opts.signal,
					timeout: timeStr(opts.timeout),
					conflict: opts.onConflict
				}
			};
		}),
		sendSignal: createTool(({ id, name }, opts) => {
			return {
				id,
				op: StepOpCode.StepPlanned,
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
			const matchOpts = { timeout: timeStr(typeof opts === "string" ? opts : opts.timeout) };
			if (typeof opts !== "string") {
				if (opts?.match) matchOpts.if = `event.${opts.match} == async.${opts.match}`;
				else if (opts?.if) matchOpts.if = opts.if;
			}
			return {
				id,
				op: StepOpCode.WaitForEvent,
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
					op: StepOpCode.AiGateway,
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
			models: { ...models }
		},
		sleep: createTool(({ id, name }, time) => {
			/**
			* The presence of this operation in the returned stack indicates that the
			* sleep is over and we should continue execution.
			*/
			const msTimeStr = timeStr(isTemporalDuration(time) ? time.total({ unit: "milliseconds" }) : time);
			return {
				id,
				op: StepOpCode.Sleep,
				name: msTimeStr,
				displayName: name ?? id
			};
		}),
		sleepUntil: createTool(({ id, name }, time) => {
			try {
				const iso = getISOString(time);
				/**
				* The presence of this operation in the returned stack indicates that the
				* sleep is over and we should continue execution.
				*/
				return {
					id,
					op: StepOpCode.Sleep,
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
			const optsSchema = invokePayloadSchema.extend({ timeout: z.union([
				z.number(),
				z.string(),
				z.date()
			]).optional() });
			const parsedFnOpts = optsSchema.extend({
				_type: z.literal("fullId").optional().default("fullId"),
				function: z.string().min(1)
			}).or(optsSchema.extend({
				_type: z.literal("fnInstance").optional().default("fnInstance"),
				function: z.instanceof(InngestFunction)
			})).or(optsSchema.extend({
				_type: z.literal("refInstance").optional().default("refInstance"),
				function: z.instanceof(InngestFunctionReference)
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
				timeout: typeof timeout === "undefined" ? void 0 : timeStr(timeout)
			};
			switch (_type) {
				case "fnInstance":
					opts.function_id = fn.id(fn["client"].id);
					break;
				case "fullId":
					console.warn(`${logPrefix} Invoking function with \`function: string\` is deprecated and will be removed in v4.0.0; use an imported function or \`referenceFunction()\` instead. See https://innge.st/ts-referencing-functions`);
					opts.function_id = fn;
					break;
				case "refInstance":
					opts.function_id = [fn.opts.appId || client.id, fn.opts.functionId].filter(Boolean).join("-");
					break;
			}
			return {
				id,
				op: StepOpCode.InvokeFunction,
				displayName: name ?? id,
				opts
			};
		}),
		fetch
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
			op: StepOpCode.Gateway,
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
const invokePayloadSchema = z.object({
	data: z.record(z.any()).optional(),
	user: z.record(z.any()).optional(),
	v: z.string().optional()
});

//#endregion
export { STEP_INDEXING_SUFFIX, createStepTools, gatewaySymbol, getStepOptions, invokePayloadSchema };
//# sourceMappingURL=InngestStepTools.js.map