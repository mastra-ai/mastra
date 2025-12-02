import { SupportedFrameworkName } from "./types.js";
import { ServeHandlerOptions } from "./components/InngestCommHandler.js";
import Koa from "koa";

//#region src/koa.d.ts

/**
 * The name of the framework, used to identify the framework in Inngest
 * dashboards and during testing.
 */
declare const frameworkName: SupportedFrameworkName;
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
declare const serve: (options: ServeHandlerOptions) => ((ctx: Koa.ParameterizedContext<Koa.DefaultState, Koa.DefaultContext, unknown>) => Promise<void>);
//#endregion
export { frameworkName, serve };
//# sourceMappingURL=koa.d.ts.map