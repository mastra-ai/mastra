import { InngestCommHandler } from "./components/InngestCommHandler.js";
import { env } from "hono/adapter";

//#region src/hono.ts
/**
* The name of the framework, used to identify the framework in Inngest
* dashboards and during testing.
*/
const frameworkName = "hono";
/**
* Using Hono, serve and register any declared functions with Inngest,
* making them available to be triggered by events.
*
* @example
* ```ts
* const handler = serve({
*   client: inngest,
*   functions
* });
*
* app.use('/api/inngest',  async (c) => {
*   return handler(c);
* });
* ```
*
* @public
*/
const serve = (options) => {
	return new InngestCommHandler({
		fetch: fetch.bind(globalThis),
		frameworkName,
		...options,
		handler: (c) => {
			return {
				transformResponse: ({ headers, status, body }) => {
					return c.body(body, {
						headers,
						status
					});
				},
				url: () => {
					try {
						return new URL(c.req.url);
					} catch {}
					const host = options.serveHost || c.req.header("host");
					if (!host) throw new Error("No host header found in request and no `serveHost` given either.");
					let baseUrl = host;
					if (!baseUrl.includes("://")) {
						let scheme = "https";
						try {
							if (process.env.NODE_ENV !== "production") scheme = "http";
						} catch (_err) {}
						baseUrl = `${scheme}://${baseUrl}`;
					}
					return new URL(c.req.url, baseUrl);
				},
				queryString: (key) => c.req.query(key),
				headers: (key) => c.req.header(key),
				method: () => c.req.method,
				body: () => c.req.json(),
				env: () => env(c)
			};
		}
	}).createHandler();
};

//#endregion
export { frameworkName, serve };
//# sourceMappingURL=hono.js.map