import { InngestCommHandler } from "./components/InngestCommHandler.js";

//#region src/digitalocean.ts
/**
* The name of the framework, used to identify the framework in Inngest
* dashboards and during testing.
*/
const frameworkName = "digitalocean";
/**
* In DigitalOcean Functions, serve and register any declared functions with
* Inngest, making them available to be triggered by events.
*
* @example
* ```ts
* import { serve } from "inngest/digitalocean";
* import { inngest } from "./src/inngest/client";
* import fnA from "./src/inngest/fnA"; // Your own function
*
* const main = serve({
*   client: inngest,
*   functions: [fnA],
*   // Your digitalocean hostname.  This is required otherwise your functions won't work.
*   serveHost: "https://faas-sfo3-your-url.doserverless.co",
*   // And your DO path, also required.
*   servePath: "/api/v1/web/fn-your-uuid/inngest",
* });
*
* // IMPORTANT: Makes the function available as a module in the project.
* // This is required for any functions that require external dependencies.
* module.exports.main = main;
* ```
*
* @public
*/
const serve = (options) => {
	return new InngestCommHandler({
		frameworkName,
		...options,
		handler: (main = {}) => {
			const { http = {
				method: "GET",
				headers: {},
				path: ""
			},...data } = main;
			return {
				body: () => data || {},
				headers: (key) => http?.headers?.[key],
				method: () => http.method,
				url: () => new URL(`${options.serveHost}${options.servePath || "/"}`),
				queryString: (key) => main[key],
				transformResponse: (res) => res
			};
		}
	}).createHandler();
};

//#endregion
export { frameworkName, serve };
//# sourceMappingURL=digitalocean.js.map