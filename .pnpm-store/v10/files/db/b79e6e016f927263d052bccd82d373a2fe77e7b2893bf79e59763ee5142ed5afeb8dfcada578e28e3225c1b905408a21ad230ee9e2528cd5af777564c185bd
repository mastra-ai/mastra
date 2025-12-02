import { SupportedFrameworkName } from "./types.js";
import { ServeHandlerOptions } from "./components/InngestCommHandler.js";

//#region src/astro.d.ts

/**
 * The name of the framework, used to identify the framework in Inngest
 * dashboards and during testing.
 */
declare const frameworkName: SupportedFrameworkName;
/**
 * In Astro, serve and register any declared functions with Inngest, making them
 * available to be triggered by events.
 *
 * @example
 * ```ts
 * export const { GET, POST, PUT } = serve({
 *   client: inngest,
 *   functions: [fn1, fn2],
 * });
 * ```
 *
 * @public
 */
declare const serve: (options: ServeHandlerOptions) => ((ctx: {
  request: Request;
}) => Promise<Response>) & {
  GET: (ctx: {
    request: Request;
  }) => Promise<Response>;
  POST: (ctx: {
    request: Request;
  }) => Promise<Response>;
  PUT: (ctx: {
    request: Request;
  }) => Promise<Response>;
};
//#endregion
export { frameworkName, serve };
//# sourceMappingURL=astro.d.ts.map