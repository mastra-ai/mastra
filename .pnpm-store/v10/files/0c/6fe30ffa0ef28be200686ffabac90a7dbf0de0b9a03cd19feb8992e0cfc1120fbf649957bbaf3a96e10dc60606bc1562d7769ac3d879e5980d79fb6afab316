const require_rolldown_runtime = require('./_virtual/rolldown_runtime.cjs');
const require_InngestCommHandler = require('./components/InngestCommHandler.cjs');
let zod_v3 = require("zod/v3");
zod_v3 = require_rolldown_runtime.__toESM(zod_v3);

//#region src/remix.ts
/**
* The name of the framework, used to identify the framework in Inngest
* dashboards and during testing.
*/
const frameworkName = "remix";
const createNewResponse = ({ body, status, headers }) => {
	/**
	* If `Response` isn't included in this environment, it's probably a Node env
	* that isn't already polyfilling. In this case, we can polyfill it here to be
	* safe.
	*/
	let Res;
	if (typeof Response === "undefined") Res = require("cross-fetch").Response;
	else Res = Response;
	return new Res(body, {
		status,
		headers
	});
};
/**
* In Remix, serve and register any declared functions with Inngest, making them
* available to be triggered by events.
*
* Remix requires that you export both a "loader" for serving `GET` requests,
* and an "action" for serving other requests, therefore exporting both is
* required.
*
* See {@link https://remix.run/docs/en/v1/guides/resource-routes}
*
* @example
* ```ts
* import { serve } from "inngest/remix";
* import functions from "~/inngest";
*
* const handler = serve({ id: "my-remix-app", functions });
*
* export { handler as loader, handler as action };
* ```
*
* @public
*/
const serve = (options) => {
	const contextSchema = zod_v3.z.object({ env: zod_v3.z.record(zod_v3.z.string(), zod_v3.z.any()) });
	return new require_InngestCommHandler.InngestCommHandler({
		frameworkName,
		...options,
		handler: ({ request: req, context }) => {
			return {
				env: () => {
					const ctxParse = contextSchema.safeParse(context);
					if (ctxParse.success && Object.keys(ctxParse.data.env).length) return ctxParse.data.env;
				},
				body: () => req.json(),
				headers: (key) => req.headers.get(key),
				method: () => req.method,
				url: () => new URL(req.url, `https://${req.headers.get("host") || ""}`),
				transformResponse: createNewResponse,
				transformStreamingResponse: createNewResponse
			};
		}
	}).createHandler();
};

//#endregion
exports.frameworkName = frameworkName;
exports.serve = serve;
//# sourceMappingURL=remix.cjs.map