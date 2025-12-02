const require_env = require('./helpers/env.cjs');
const require_InngestCommHandler = require('./components/InngestCommHandler.cjs');

//#region src/redwood.ts
/**
* The name of the framework, used to identify the framework in Inngest
* dashboards and during testing.
*/
const frameworkName = "redwoodjs";
/**
* In Redwood.js, serve and register any declared functions with Inngest, making
* them available to be triggered by events.
*
* @example
* ```ts
* import { serve } from "inngest/redwood";
* import { inngest } from "src/inngest/client";
* import fnA from "src/inngest/fnA"; // Your own function
*
* export const handler = serve({
*   client: inngest,
*   functions: [fnA],
*   servePath: "/api/inngest",
* });
* ```
*
* @public
*/
const serve = (options) => {
	return new require_InngestCommHandler.InngestCommHandler({
		frameworkName,
		...options,
		handler: (event, _context) => {
			return {
				body: () => {
					return JSON.parse(event.body ? event.isBase64Encoded ? Buffer.from(event.body, "base64").toString() : event.body : "{}");
				},
				headers: (key) => event.headers[key],
				method: () => event.httpMethod,
				url: () => {
					const scheme = require_env.processEnv("NODE_ENV") === "development" ? "http" : "https";
					return new URL(event.path, `${scheme}://${event.headers.host || ""}`);
				},
				queryString: (key) => event.queryStringParameters?.[key],
				transformResponse: ({ body, status: statusCode, headers }) => {
					return {
						body,
						statusCode,
						headers
					};
				}
			};
		}
	}).createHandler();
};

//#endregion
exports.frameworkName = frameworkName;
exports.serve = serve;
//# sourceMappingURL=redwood.cjs.map