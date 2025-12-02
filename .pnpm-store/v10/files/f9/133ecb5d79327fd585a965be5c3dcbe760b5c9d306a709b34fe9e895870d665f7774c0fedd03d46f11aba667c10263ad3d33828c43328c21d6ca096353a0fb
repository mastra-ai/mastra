import { SupportedFrameworkName } from "../types.cjs";
import { ServeHandlerOptions } from "../components/InngestCommHandler.cjs";

//#region src/deno/fresh.d.ts

/**
 * The name of the framework, used to identify the framework in Inngest
 * dashboards and during testing.
 */
declare const frameworkName: SupportedFrameworkName;
/**
 * With Deno's Fresh framework, serve and register any declared functions with
 * Inngest, making them available to be triggered by events.
 *
 * @example
 * ```ts
 * import { serve } from "https://esm.sh/inngest/deno/fresh";
 * import { inngest } from "./src/inngest/client.ts";
 * import fnA from "./src/inngest/fnA"; // Your own function
 *
 * export const handler = serve({
 *   client: inngest,
 *   functions: [fnA],
 * });
 * ```
 *
 * @public
 */
declare const serve: (options: ServeHandlerOptions) => ((req: Request) => Promise<Response>);
//#endregion
export { frameworkName, serve };
//# sourceMappingURL=fresh.d.cts.map