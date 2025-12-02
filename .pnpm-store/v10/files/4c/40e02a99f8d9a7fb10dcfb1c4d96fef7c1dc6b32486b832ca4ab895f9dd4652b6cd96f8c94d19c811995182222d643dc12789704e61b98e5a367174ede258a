import { processEnv } from "./helpers/env.js";
import { InngestCommHandler } from "./components/InngestCommHandler.js";
import { getHeader, getQuery, readBody, send, setHeaders } from "h3";

//#region src/h3.ts
/**
* The name of the framework, used to identify the framework in Inngest
* dashboards and during testing.
*/
const frameworkName = "h3";
/**
* In h3, serve and register any declared functions with Inngest, making
* them available to be triggered by events.
*
* @example
* ```ts
* import { createApp, eventHandler, toNodeListener } from "h3";
* import { serve } from "inngest/h3";
* import { createServer } from "node:http";
* import { inngest } from "./inngest/client";
* import fnA from "./inngest/fnA";
*
* const app = createApp();
* app.use(
*   "/api/inngest",
*   eventHandler(
*     serve({
*       client: inngest,
*       functions: [fnA],
*     })
*   )
* );
*
* createServer(toNodeListener(app)).listen(process.env.PORT || 3000);
* ```
*
* @public
*/
const serve = (options) => {
	return new InngestCommHandler({
		frameworkName,
		...options,
		handler: (event) => {
			return {
				body: () => readBody(event),
				headers: (key) => getHeader(event, key),
				method: () => event.method,
				url: () => {
					let scheme = "https";
					if ((processEnv("NODE_ENV") ?? "dev").startsWith("dev")) scheme = "http";
					return new URL(String(event.path), `${scheme}://${String(getHeader(event, "host"))}`);
				},
				queryString: (key) => {
					const param = getQuery(event)[key];
					if (param) return String(param);
				},
				transformResponse: (actionRes) => {
					const { res } = event.node;
					res.statusCode = actionRes.status;
					setHeaders(event, actionRes.headers);
					return send(event, actionRes.body);
				}
			};
		}
	}).createHandler();
};

//#endregion
export { frameworkName, serve };
//# sourceMappingURL=h3.js.map