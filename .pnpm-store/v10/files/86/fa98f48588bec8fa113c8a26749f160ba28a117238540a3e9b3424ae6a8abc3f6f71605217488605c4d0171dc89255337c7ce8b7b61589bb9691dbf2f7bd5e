const require_InngestCommHandler = require('./components/InngestCommHandler.cjs');

//#region src/express.ts
/**
* The name of the framework, used to identify the framework in Inngest
* dashboards and during testing.
*/
const frameworkName = "express";
/**
* Serve and register any declared functions with Inngest, making them available
* to be triggered by events.
*
* The return type is currently `any` to ensure there's no required type matches
* between the `express` and `vercel` packages. This may change in the future to
* appropriately infer.
*
* @example
* ```ts
* import { serve } from "inngest/express";
* import { inngest } from "./src/inngest/client";
* import fnA from "./src/inngest/fnA"; // Your own function
*
* // Important:  ensure you add JSON middleware to process incoming JSON POST payloads.
* app.use(express.json());
* app.use(
*   // Expose the middleware on our recommended path at `/api/inngest`.
*   "/api/inngest",
*   serve({ client: inngest, functions: [fnA] })
* );
* ```
*
* @public
*/
const serve = (options) => {
	return new require_InngestCommHandler.InngestCommHandler({
		frameworkName,
		...options,
		handler: (req, res) => {
			return {
				body: () => req.body,
				headers: (key) => {
					const header = req.headers[key];
					return Array.isArray(header) ? header[0] : header;
				},
				method: () => req.method || "GET",
				url: () => {
					const hostname = req.headers["host"] || options?.serveHost;
					const protocol = hostname?.includes("://") ? "" : `${req.protocol || "https"}://`;
					return new URL(req.originalUrl || req.url || "", `${protocol}${hostname || ""}`);
				},
				queryString: (key) => {
					const qs = req.query[key];
					return Array.isArray(qs) ? qs[0] : qs;
				},
				transformResponse: ({ body, headers, status }) => {
					for (const [name, value] of Object.entries(headers)) res.setHeader(name, value);
					return res.status(status).send(body);
				},
				transformStreamingResponse: async ({ body, headers, status }) => {
					for (const [name, value] of Object.entries(headers)) res.setHeader(name, value);
					res.status(status);
					const reader = body.getReader();
					try {
						let done = false;
						while (!done) {
							const result = await reader.read();
							done = result.done;
							if (!done) res.write(result.value);
						}
						res.end();
					} catch (error) {
						if (error instanceof Error) res.destroy(error);
						else res.destroy(new Error(String(error)));
					}
				}
			};
		}
	}).createHandler();
};

//#endregion
exports.frameworkName = frameworkName;
exports.serve = serve;
//# sourceMappingURL=express.cjs.map