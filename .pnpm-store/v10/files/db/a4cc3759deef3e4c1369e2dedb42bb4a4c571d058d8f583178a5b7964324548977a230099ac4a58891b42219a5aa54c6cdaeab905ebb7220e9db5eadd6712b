const require_rolldown_runtime = require('./_virtual/rolldown_runtime.cjs');
const require_env = require('./helpers/env.cjs');
const require_InngestCommHandler = require('./components/InngestCommHandler.cjs');
let h3 = require("h3");
h3 = require_rolldown_runtime.__toESM(h3);

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
	return new require_InngestCommHandler.InngestCommHandler({
		frameworkName,
		...options,
		handler: (event) => {
			return {
				body: () => (0, h3.readBody)(event),
				headers: (key) => (0, h3.getHeader)(event, key),
				method: () => event.method,
				url: () => {
					let scheme = "https";
					if ((require_env.processEnv("NODE_ENV") ?? "dev").startsWith("dev")) scheme = "http";
					return new URL(String(event.path), `${scheme}://${String((0, h3.getHeader)(event, "host"))}`);
				},
				queryString: (key) => {
					const param = (0, h3.getQuery)(event)[key];
					if (param) return String(param);
				},
				transformResponse: (actionRes) => {
					const { res } = event.node;
					res.statusCode = actionRes.status;
					(0, h3.setHeaders)(event, actionRes.headers);
					return (0, h3.send)(event, actionRes.body);
				}
			};
		}
	}).createHandler();
};

//#endregion
exports.frameworkName = frameworkName;
exports.serve = serve;
//# sourceMappingURL=h3.cjs.map