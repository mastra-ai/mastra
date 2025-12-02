import { SupportedFrameworkName } from "./types.js";
import { ServeHandlerOptions } from "./components/InngestCommHandler.js";

//#region src/bun.d.ts

/**
 * The name of the framework, used to identify the framework in Inngest
 * dashboards and during testing.
 */
declare const frameworkName: SupportedFrameworkName;
/**
 * Using `Bun.serve()`, serve and register any declared functions with Inngest,
 * making them available to be triggered by events.
 *
 * @example
 * ```ts
 * import { serve } from "inngest/bun";
 * import { functions, inngest } from "./inngest";
 *
 * Bun.serve({
 *   port: 3000,
 *   fetch(request: Request) {
 *     const url = new URL(request.url);
 *
 *     if (url.pathname === "/api/inngest") {
 *       return serve({ client: inngest, functions })(request);
 *     }
 *
 *     return new Response("Not found", { status: 404 });
 *   },
 * });
 * ```
 *
 * @public
 */
declare const serve: (options: ServeHandlerOptions) => ((req: Request) => Promise<Response>);
//#endregion
export { frameworkName, serve };
//# sourceMappingURL=bun.d.ts.map