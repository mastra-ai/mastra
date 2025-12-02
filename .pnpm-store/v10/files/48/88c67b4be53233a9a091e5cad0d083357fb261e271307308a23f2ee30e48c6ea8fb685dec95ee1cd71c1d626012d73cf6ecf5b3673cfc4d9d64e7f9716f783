const require_InngestCommHandler = require('./components/InngestCommHandler.cjs');

//#region src/koa.ts
/**
* The name of the framework, used to identify the framework in Inngest
* dashboards and during testing.
*/
const frameworkName = "koa";
/**
* Using Koa, serve and register any declared functions with Inngest,
* making them available to be triggered by events.
*
* @example
* ```ts
* const handler = serve({
*   client: inngest,
*   functions
* });
*
* app.use((ctx) => {
*   if (ctx.request.path === "/api/inngest") {
*     return handler(ctx);
*   }
* });
* ```
*
* @public
*/
const serve = (options) => {
	return new require_InngestCommHandler.InngestCommHandler({
		frameworkName,
		...options,
		handler: (ctx) => {
			return {
				method: () => ctx.method,
				body: () => ctx.request.body,
				headers: (key) => {
					const header = ctx.headers[key];
					if (Array.isArray(header)) return header[0];
					return header;
				},
				queryString: (key) => {
					const qs = ctx.query[key];
					if (Array.isArray(qs)) return qs[0];
					return qs;
				},
				url: () => {
					const hostname = ctx.host;
					const protocol = hostname?.includes("://") ? "" : `${ctx.protocol}://`;
					return new URL(ctx.originalUrl, `${protocol}${hostname || ""}`);
				},
				transformResponse: ({ body, headers, status }) => {
					for (const [name, value] of Object.entries(headers)) ctx.set(name, value);
					ctx.status = status;
					ctx.body = body;
				}
			};
		}
	}).createHandler();
};

//#endregion
exports.frameworkName = frameworkName;
exports.serve = serve;
//# sourceMappingURL=koa.cjs.map