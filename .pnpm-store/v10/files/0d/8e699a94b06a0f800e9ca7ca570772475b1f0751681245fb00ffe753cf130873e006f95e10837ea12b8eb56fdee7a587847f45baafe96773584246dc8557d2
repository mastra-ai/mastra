import { InngestCommHandler } from "../components/InngestCommHandler.js";

//#region src/deno/fresh.ts
/**
* The name of the framework, used to identify the framework in Inngest
* dashboards and during testing.
*/
const frameworkName = "deno/fresh";
/**
* With Deno's Fresh framework, serve and register any declared functions with
* Inngest, making them available to be triggered by events.
*
* @example
* ```ts
* import { serve } from "https://esm.sh/inngest/deno/fresh";
* import { inngest } from "./src/inngest/client.ts";
* import fnA from "./src/inngest/fnA"; // Your own function
*
* export const handler = serve({
*   client: inngest,
*   functions: [fnA],
* });
* ```
*
* @public
*/
const serve = (options) => {
	const fn = new InngestCommHandler({
		frameworkName,
		...options,
		handler: (req, env) => {
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
				}
			};
		}
	}).createHandler();
	return function handleRequest(req, ...other) {
		return fn(req, Deno.env.toObject(), ...other);
	};
};

//#endregion
export { frameworkName, serve };
//# sourceMappingURL=fresh.js.map