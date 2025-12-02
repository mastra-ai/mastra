const require_InngestCommHandler = require('./components/InngestCommHandler.cjs');

//#region src/cloudflare.ts
/**
* The name of the framework, used to identify the framework in Inngest
* dashboards and during testing.
*/
const frameworkName = "cloudflare-pages";
/**
* Support both Cloudflare Pages Functions and Cloudflare Workers by lightly
* asserting the shape of the input arguments at runtime.
*/
const deriveHandlerArgs = (args) => {
	if (!Array.isArray(args) || args.length < 1) throw new Error("No arguments passed to serve handler");
	if (typeof args[0] === "object" && "request" in args[0] && "env" in args[0]) return {
		req: args[0].request,
		env: args[0].env
	};
	if (args.length > 1 && typeof args[1] === "object") return {
		req: args[0],
		env: args[1]
	};
	throw new Error("Could not derive handler arguments from input; are you sure you're using serve() correctly?");
};
/**
* In Cloudflare, serve and register any declared functions with Inngest, making
* them available to be triggered by events.
*
* @example Cloudflare Pages
* ```ts
* import { serve } from "inngest/cloudflare";
* import { inngest } from "../../inngest/client";
* import fnA from "../../inngest/fnA"; // Your own function
*
* export const onRequest = serve({
*   client: inngest,
*   functions: [fnA],
* });
* ```
*
* @example Cloudflare Workers
* ```ts
* import { serve } from "inngest/cloudflare";
* import { inngest } from "../../inngest/client";
* import fnA from "../../inngest/fnA"; // Your own function
*
* export default {
*   fetch: serve({
*     client: inngest,
*     functions: [fnA],
*   }),
* };
* ```
*
* @public
*/
const serve = (options) => {
	const handler = new require_InngestCommHandler.InngestCommHandler({
		frameworkName,
		fetch: fetch.bind(globalThis),
		...options,
		handler: (...args) => {
			const { req, env } = deriveHandlerArgs(args);
			return {
				body: () => req.json(),
				headers: (key) => req.headers.get(key),
				method: () => req.method,
				env: () => env,
				url: () => new URL(req.url, `https://${req.headers.get("host") || ""}`),
				transformResponse: ({ body, status, headers }) => {
					return new Response(body, {
						status,
						headers
					});
				},
				transformStreamingResponse: ({ body, status, headers }) => {
					return new Response(body, {
						status,
						headers
					});
				}
			};
		}
	});
	return Object.defineProperties(handler.createHandler(), { length: { value: 2 } });
};

//#endregion
exports.frameworkName = frameworkName;
exports.serve = serve;
//# sourceMappingURL=cloudflare.cjs.map