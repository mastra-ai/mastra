const require_rolldown_runtime = require('../_virtual/rolldown_runtime.cjs');
const require_als = require('./execution/als.cjs');
const require_InngestStepTools = require('./InngestStepTools.cjs');
let debug = require("debug");
debug = require_rolldown_runtime.__toESM(debug);

//#region src/components/Fetch.ts
const globalFetch = globalThis.fetch;
const debug$1 = (0, debug.default)("inngest:fetch");
const createFetchShim = () => {
	let stepFetch;
	const fetch$1 = async (input, init) => {
		const ctx = await require_als.getAsyncCtx();
		if (!ctx) {
			if (!stepFetch.fallback) throw new Error("step.fetch() called outside of a function and had no fallback set");
			debug$1("step.fetch() called outside of a function; falling back to global fetch");
			return stepFetch.fallback(input, init);
		}
		if (ctx.executingStep) {
			if (!stepFetch.fallback) throw new Error(`step.fetch() called inside step "${ctx.executingStep.id}" and had no fallback set`);
			debug$1(`step.fetch() called inside step "${ctx.executingStep.id}"; falling back to global fetch`);
			return stepFetch.fallback(input, init);
		}
		const targetUrl = new URL(input instanceof Request ? input.url : input.toString());
		debug$1("step.fetch() shimming request to", targetUrl.hostname);
		const jsonRes = await ctx.ctx.step[require_InngestStepTools.gatewaySymbol](`step.fetch: ${targetUrl.hostname}`, input, init);
		return new Response(jsonRes.body, {
			headers: jsonRes.headers,
			status: jsonRes.status
		});
	};
	const optionsRef = { fallback: globalFetch };
	const extras = {
		config: (options) => {
			Object.assign(optionsRef, options);
			Object.assign(stepFetch, optionsRef);
			return stepFetch;
		},
		...optionsRef
	};
	stepFetch = Object.assign(fetch$1, extras);
	return stepFetch;
};
/**
* `fetch` is a Fetch API-compatible function that can be used to make any HTTP
* code durable if it's called within an Inngest function.
*
* It will gracefully fall back to the global `fetch` if called outside of this
* context, and a custom fallback can be set using the `config` method.
*
* @example Basic usage
* ```ts
* import { fetch } from "inngest";
*
* const api = new MyProductApi({ fetch });
* ```
*
* @example Setting a custom fallback
* ```ts
* import { fetch } from "inngest";
*
* const api = new MyProductApi({
*            fetch: fetch.config({ fallback: myCustomFetch }),
* });
* ```
*
* @example Do not allow fallback
* ```ts
* import { fetch } from "inngest";
*
* const api = new MyProductApi({
*            fetch: fetch.config({ fallback: undefined }),
* });
* ```
*/
const fetch = createFetchShim();

//#endregion
exports.fetch = fetch;
//# sourceMappingURL=Fetch.cjs.map