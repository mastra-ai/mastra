import { InngestCommHandler } from "./components/InngestCommHandler.js";

//#region src/edge.ts
/**
* The name of the framework, used to identify the framework in Inngest
* dashboards and during testing.
*/
const frameworkName = "edge";
/**
* In an edge runtime, serve and register any declared functions with Inngest,
* making them available to be triggered by events.
*
* The edge runtime is a generic term for any serverless runtime that supports
* only standard Web APIs such as `fetch`, `Request`, and `Response`, such as
* Cloudflare Workers, Vercel Edge Functions, and AWS Lambda@Edge.
*
* @example
* ```ts
* import { serve } from "inngest/edge";
* import functions from "~/inngest";
*
* export const handler = serve({ id: "my-edge-app", functions });
* ```
*
* @public
*/
const serve = (options) => {
	return new InngestCommHandler({
		frameworkName,
		fetch: fetch.bind(globalThis),
		...options,
		handler: (req) => {
			return {
				body: () => req.json(),
				headers: (key) => req.headers.get(key),
				method: () => req.method,
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
};

//#endregion
export { frameworkName, serve };
//# sourceMappingURL=edge.js.map