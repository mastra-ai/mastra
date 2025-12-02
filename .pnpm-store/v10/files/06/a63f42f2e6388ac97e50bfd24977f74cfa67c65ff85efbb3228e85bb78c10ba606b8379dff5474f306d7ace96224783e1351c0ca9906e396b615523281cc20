import { SupportedFrameworkName } from "./types.cjs";
import { ServeHandlerOptions } from "./components/InngestCommHandler.cjs";
import { RequestEvent } from "@sveltejs/kit";

//#region src/sveltekit.d.ts

/**
 * The name of the framework, used to identify the framework in Inngest
 * dashboards and during testing.
 */
declare const frameworkName: SupportedFrameworkName;
/**
 * Using SvelteKit, serve and register any declared functions with Inngest,
 * making them available to be triggered by events.
 *
 * @example
 * ```ts
 * // app/routes/api.inngest.ts
 * // (for Remix 1, use app/routes/api/inngest.ts)
 * import { serve } from "inngest/remix";
 * import { inngest } from "~/inngest/client";
 * import fnA from "~/inngest/fnA";
 *
 * const handler = serve({
 *   client: inngest,
 *   functions: [fnA],
 * });
 *
 * export { handler as action, handler as loader };
 * ```
 *
 * @public
 */
declare const serve: (options: ServeHandlerOptions) => ((event: RequestEvent) => Promise<Response>) & {
  GET: (event: RequestEvent) => Promise<Response>;
  POST: (event: RequestEvent) => Promise<Response>;
  PUT: (event: RequestEvent) => Promise<Response>;
};
//#endregion
export { frameworkName, serve };
//# sourceMappingURL=sveltekit.d.cts.map