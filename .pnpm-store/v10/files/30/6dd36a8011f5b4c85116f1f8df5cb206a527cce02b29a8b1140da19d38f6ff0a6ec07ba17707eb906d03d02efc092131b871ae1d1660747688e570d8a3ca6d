import { InngestCommHandler } from "./components/InngestCommHandler.js";

//#region src/lambda.ts
/**
* The name of the framework, used to identify the framework in Inngest
* dashboards and during testing.
*/
const frameworkName = "aws-lambda";
/**
* With AWS Lambda, serve and register any declared functions with Inngest,
* making them available to be triggered by events.
*
* @example
*
* ```ts
* import { Inngest } from "inngest";
* import { serve } from "inngest/lambda";
*
* const inngest = new Inngest({ id: "my-lambda-app" });
*
* const fn = inngest.createFunction(
*   { id: "hello-world" },
*   { event: "test/hello.world" },
*   async ({ event }) => {
*    return "Hello World";
*  }
* );
*
* export const handler = serve({ client: inngest, functions: [fn] });
* ```
*
* @public
*/
const serve = (options) => {
	return new InngestCommHandler({
		frameworkName,
		...options,
		handler: (event, _context) => {
			/**
			* Try to handle multiple incoming event types, as Lambda can have many
			* triggers.
			*
			* This still doesn't handle all cases, but it's a start.
			*/
			const eventIsV2 = ((ev) => {
				return ev.version === "2.0";
			})(event);
			const headersMap = new Map([...Object.entries(event.headers).map(([key, value]) => [key.toLowerCase().trim(), value])]);
			const getHeader = (key) => {
				return headersMap.get(key.toLowerCase().trim());
			};
			return {
				body: () => {
					return JSON.parse(event.body ? event.isBase64Encoded ? Buffer.from(event.body, "base64").toString() : event.body : "{}");
				},
				headers: getHeader,
				method: () => {
					return eventIsV2 ? event.requestContext.http.method : event.httpMethod;
				},
				url: () => {
					const path = eventIsV2 ? event.requestContext.http.path : event.path;
					const proto = getHeader("x-forwarded-proto") || "https";
					return new URL(path, `${proto}://${getHeader("host") || ""}`);
				},
				queryString: (key) => {
					return event.queryStringParameters?.[key];
				},
				transformResponse: ({ body, status: statusCode, headers }) => {
					return Promise.resolve({
						body,
						statusCode,
						headers
					});
				}
			};
		}
	}).createHandler();
};

//#endregion
export { frameworkName, serve };
//# sourceMappingURL=lambda.js.map