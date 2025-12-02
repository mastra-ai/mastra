import { ExecutionVersion, internalEvents, queryKeys } from "../helpers/consts.js";
import { timeStr } from "../helpers/strings.js";
import { createV0InngestExecution } from "./execution/v0.js";
import { createV1InngestExecution } from "./execution/v1.js";
import { createV2InngestExecution } from "./execution/v2.js";

//#region src/components/InngestFunction.ts
/**
* A stateless Inngest function, wrapping up function configuration and any
* in-memory steps to run when triggered.
*
* This function can be "registered" to create a handler that Inngest can
* trigger remotely.
*
* @public
*/
var InngestFunction = class InngestFunction {
	static stepId = "step";
	static failureSuffix = "-failure";
	get [Symbol.toStringTag]() {
		return InngestFunction.Tag;
	}
	opts;
	fn;
	onFailureFn;
	client;
	middleware;
	/**
	* A stateless Inngest function, wrapping up function configuration and any
	* in-memory steps to run when triggered.
	*
	* This function can be "registered" to create a handler that Inngest can
	* trigger remotely.
	*/
	constructor(client, opts, fn) {
		this.client = client;
		this.opts = opts;
		this.fn = fn;
		this.onFailureFn = this.opts.onFailure;
		this.middleware = this.client["initializeMiddleware"](this.opts.middleware, {
			registerInput: { fn: this },
			prefixStack: this.client["middleware"]
		});
	}
	/**
	* The generated or given ID for this function.
	*/
	id(prefix) {
		return [prefix, this.opts.id].filter(Boolean).join("-");
	}
	/**
	* The generated or given ID for this function, prefixed with the app ID. This
	* is used for routing invokes and identifying the function across apps.
	*/
	get absoluteId() {
		return this.id(this.client.id);
	}
	/**
	* The name of this function as it will appear in the Inngest Cloud UI.
	*/
	get name() {
		return this.opts.name || this.id();
	}
	/**
	* The description of this function.
	*/
	get description() {
		return this.opts.description;
	}
	/**
	* Retrieve the Inngest config for this function.
	*/
	getConfig({ baseUrl, appPrefix, isConnect }) {
		const fnId = this.id(appPrefix);
		const stepUrl = new URL(baseUrl.href);
		stepUrl.searchParams.set(queryKeys.FnId, fnId);
		stepUrl.searchParams.set(queryKeys.StepId, InngestFunction.stepId);
		const { retries: attempts, cancelOn, idempotency, batchEvents, rateLimit, throttle, concurrency, debounce, timeouts, priority, singleton } = this.opts;
		/**
		* Convert retries into the format required when defining function
		* configuration.
		*/
		const retries = typeof attempts === "undefined" ? void 0 : { attempts };
		const fn = {
			id: fnId,
			name: this.name,
			triggers: (this.opts.triggers ?? []).map((trigger) => {
				if ("event" in trigger) return {
					event: trigger.event,
					expression: trigger.if
				};
				return { cron: trigger.cron };
			}),
			steps: { [InngestFunction.stepId]: {
				id: InngestFunction.stepId,
				name: InngestFunction.stepId,
				runtime: {
					type: isConnect ? "ws" : "http",
					url: stepUrl.href
				},
				retries
			} },
			idempotency,
			batchEvents,
			rateLimit,
			throttle,
			concurrency,
			debounce,
			priority,
			timeouts,
			singleton
		};
		if (cancelOn) fn.cancel = cancelOn.map(({ event, timeout, if: ifStr, match }) => {
			const ret = { event };
			if (timeout) ret.timeout = timeStr(timeout);
			if (match) ret.if = `event.${match} == async.${match}`;
			else if (ifStr) ret.if = ifStr;
			return ret;
		}, []);
		const config = [fn];
		if (this.onFailureFn) {
			const id = `${fn.id}${InngestFunction.failureSuffix}`;
			const name = `${fn.name ?? fn.id} (failure)`;
			const failureStepUrl = new URL(stepUrl.href);
			failureStepUrl.searchParams.set(queryKeys.FnId, id);
			config.push({
				id,
				name,
				triggers: [{
					event: internalEvents.FunctionFailed,
					expression: `event.data.function_id == '${fnId}'`
				}],
				steps: { [InngestFunction.stepId]: {
					id: InngestFunction.stepId,
					name: InngestFunction.stepId,
					runtime: {
						type: "http",
						url: failureStepUrl.href
					},
					retries: { attempts: 1 }
				} }
			});
		}
		return config;
	}
	createExecution(opts) {
		const options = {
			fn: this,
			...opts.partialOptions
		};
		return {
			[ExecutionVersion.V2]: () => createV2InngestExecution(options),
			[ExecutionVersion.V1]: () => createV1InngestExecution(options),
			[ExecutionVersion.V0]: () => createV0InngestExecution(options)
		}[opts.version]();
	}
	shouldOptimizeParallelism() {
		return this.opts.optimizeParallelism ?? this.client["options"].optimizeParallelism ?? false;
	}
};
(function(_InngestFunction) {
	_InngestFunction.Tag = "Inngest.Function";
})(InngestFunction || (InngestFunction = {}));

//#endregion
export { InngestFunction };
//# sourceMappingURL=InngestFunction.js.map