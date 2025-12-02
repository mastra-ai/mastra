import { InngestFunction } from "./components/InngestFunction.js";
import { RegisterOptions, SupportedFrameworkName } from "./types.js";
import { Inngest } from "./components/Inngest.js";
import { ServeHandlerOptions } from "./components/InngestCommHandler.js";
import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

//#region src/fastify.d.ts

/**
 * The name of the framework, used to identify the framework in Inngest
 * dashboards and during testing.
 */
declare const frameworkName: SupportedFrameworkName;
type InngestPluginOptions = {
  client: Inngest.Like;
  functions: InngestFunction.Like[];
  options?: RegisterOptions;
};
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
declare const serve: (options: ServeHandlerOptions) => ((req: FastifyRequest<{
  Querystring: Record<string, string | undefined>;
}>, reply: FastifyReply) => Promise<unknown>);
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
declare const fastifyPlugin: (fastify: FastifyInstance, options: InngestPluginOptions, done: (err?: Error | undefined) => void) => void;
//#endregion
export { fastifyPlugin as default, fastifyPlugin, frameworkName, serve };
//# sourceMappingURL=fastify.d.ts.map