import { __require } from "./_virtual/rolldown_runtime.js";
import { processEnv } from "./helpers/env.js";
import { InngestCommHandler } from "./components/InngestCommHandler.js";

//#region src/sveltekit.ts
/**
* The name of the framework, used to identify the framework in Inngest
* dashboards and during testing.
*/
const frameworkName = "sveltekit";
/**
* Using SvelteKit, serve and register any declared functions with Inngest,
* making them available to be triggered by events.
*
* @example
* ```ts
* // app/routes/api.inngest.ts
* // (for Remix 1, use app/routes/api/inngest.ts)
* import { serve } from "inngest/remix";
* import { inngest } from "~/inngest/client";
* import fnA from "~/inngest/fnA";
*
* const handler = serve({
*   client: inngest,
*   functions: [fnA],
* });
*
* export { handler as action, handler as loader };
* ```
*
* @public
*/
const serve = (options) => {
	const baseFn = new InngestCommHandler({
		frameworkName,
		...options,
		handler: (reqMethod, event) => {
			return {
				method: () => reqMethod || event.request.method || "",
				body: () => event.request.json(),
				headers: (key) => event.request.headers.get(key),
				url: () => {
					const protocol = processEnv("NODE_ENV") === "development" ? "http" : "https";
					return new URL(event.request.url, `${protocol}://${event.request.headers.get("host") || options.serveHost || ""}`);
				},
				transformResponse: ({ body, headers, status }) => {
					/**
					* If `Response` isn't included in this environment, it's probably a
					* Node env that isn't already polyfilling. In this case, we can
					* polyfill it here to be safe.
					*/
					let Res;
					if (typeof Response === "undefined") Res = __require("cross-fetch").Response;
					else Res = Response;
					return new Res(body, {
						status,
						headers
					});
				}
			};
		}
	}).createHandler();
	const fn = baseFn.bind(null, void 0);
	return Object.defineProperties(fn, {
		GET: { value: baseFn.bind(null, "GET") },
		POST: { value: baseFn.bind(null, "POST") },
		PUT: { value: baseFn.bind(null, "PUT") }
	});
};

//#endregion
export { frameworkName, serve };
//# sourceMappingURL=sveltekit.js.map