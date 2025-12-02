import { __require } from "./_virtual/rolldown_runtime.js";
import { InngestCommHandler } from "./components/InngestCommHandler.js";
import { z } from "zod/v3";

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
	if (typeof Response === "undefined") Res = __require("cross-fetch").Response;
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
	const contextSchema = z.object({ env: z.record(z.string(), z.any()) });
	return new InngestCommHandler({
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
export { frameworkName, serve };
//# sourceMappingURL=remix.js.map