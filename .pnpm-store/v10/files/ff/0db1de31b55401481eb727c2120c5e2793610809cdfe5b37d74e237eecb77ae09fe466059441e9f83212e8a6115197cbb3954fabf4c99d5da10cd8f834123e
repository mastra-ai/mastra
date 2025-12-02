import { InngestCommHandler } from "./components/InngestCommHandler.js";

//#region src/astro.ts
/**
* The name of the framework, used to identify the framework in Inngest
* dashboards and during testing.
*/
const frameworkName = "astro";
/**
* In Astro, serve and register any declared functions with Inngest, making them
* available to be triggered by events.
*
* @example
* ```ts
* export const { GET, POST, PUT } = serve({
*   client: inngest,
*   functions: [fn1, fn2],
* });
* ```
*
* @public
*/
const serve = (options) => {
	const requestHandler = new InngestCommHandler({
		frameworkName,
		fetch: fetch.bind(globalThis),
		...options,
		handler: ({ request: req }) => {
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
	return Object.defineProperties(requestHandler, {
		GET: { value: requestHandler },
		POST: { value: requestHandler },
		PUT: { value: requestHandler }
	});
};

//#endregion
export { frameworkName, serve };
//# sourceMappingURL=astro.js.map