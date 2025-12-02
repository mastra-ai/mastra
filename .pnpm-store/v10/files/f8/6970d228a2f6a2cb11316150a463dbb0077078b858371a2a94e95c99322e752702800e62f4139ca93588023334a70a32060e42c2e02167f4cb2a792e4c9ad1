Object.defineProperty(exports, '__esModule', { value: true });
const require_InngestCommHandler = require('./components/InngestCommHandler.cjs');

//#region src/fastify.ts
/**
* The name of the framework, used to identify the framework in Inngest
* dashboards and during testing.
*/
const frameworkName = "fastify";
/**
* Serve and register any declared functions with Inngest, making them available
* to be triggered by events.
*
* It's recommended to use the Fastify plugin to serve your functions with
* Inngest instead of using this `serve()` function directly.
*
* @example
* ```ts
* import Fastify from "fastify";
* import { serve } from "inngest/fastify";
* import { fnA, inngest } from "./inngest";
*
* const fastify = Fastify();
*
* fastify.route({
*   method: ["GET", "POST", "PUT"],
*   handler: serve({ client: inngest, functions: [fnA] }),
*   url: "/api/inngest",
* });
*
* fastify.listen({ port: 3000 }, function (err, address) {
*   if (err) {
*     fastify.log.error(err);
*     process.exit(1);
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
		handler: (req, reply) => {
			return {
				body: () => req.body,
				headers: (key) => {
					const header = req.headers[key];
					return Array.isArray(header) ? header[0] : header;
				},
				method: () => req.method,
				url: () => {
					const hostname = req.headers["host"];
					const protocol = hostname?.includes("://") ? "" : `${req.protocol}://`;
					return new URL(req.url, `${protocol}${hostname || ""}`);
				},
				queryString: (key) => req.query[key],
				transformResponse: ({ body, status, headers }) => {
					for (const [name, value] of Object.entries(headers)) reply.header(name, value);
					reply.code(status);
					return reply.send(body);
				}
			};
		}
	}).createHandler();
};
/**
* Serve and register any declared functions with Inngest, making them available
* to be triggered by events.
*
* @example
* ```ts
* import Fastify from "fastify";
* import inngestFastify from "inngest/fastify";
* import { inngest, fnA } from "./inngest";
*
* const fastify = Fastify();
*
* fastify.register(inngestFastify, {
*   client: inngest,
*   functions: [fnA],
*   options: {},
* });
*
* fastify.listen({ port: 3000 }, function (err, address) {
*   if (err) {
*     fastify.log.error(err);
*     process.exit(1);
*   }
* });
* ```
*
* @public
*/
const fastifyPlugin = ((fastify, options, done) => {
	if (!options?.client) throw new Error("Inngest `client` is required when serving with Fastify plugin");
	if (!options?.functions) throw new Error("Inngest `functions` are required when serving with Fastify plugin");
	try {
		const handler = serve({
			client: options?.client,
			functions: options?.functions,
			...options?.options
		});
		fastify.route({
			method: [
				"GET",
				"POST",
				"PUT"
			],
			handler,
			url: options?.options?.servePath || "/api/inngest"
		});
		done();
	} catch (err) {
		done(err);
	}
});
var fastify_default = fastifyPlugin;

//#endregion
exports.default = fastify_default;
exports.fastifyPlugin = fastifyPlugin;
exports.frameworkName = frameworkName;
exports.serve = serve;
//# sourceMappingURL=fastify.cjs.map