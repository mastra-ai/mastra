import { SupportedFrameworkName } from "./types.cjs";
import { ServeHandlerOptions } from "./components/InngestCommHandler.cjs";
import { Context } from "hono";

//#region src/hono.d.ts

/**
 * The name of the framework, used to identify the framework in Inngest
 * dashboards and during testing.
 */
declare const frameworkName: SupportedFrameworkName;
/**
 * Using Hono, serve and register any declared functions with Inngest,
 * making them available to be triggered by events.
 *
 * @example
 * ```ts
 * const handler = serve({
 *   client: inngest,
 *   functions
 * });
 *
 * app.use('/api/inngest',  async (c) => {
 *   return handler(c);
 * });
 * ```
 *
 * @public
 */
declare const serve: (options: ServeHandlerOptions) => ((c: Context) => Promise<Response>);
//#endregion
export { frameworkName, serve };
//# sourceMappingURL=hono.d.cts.map