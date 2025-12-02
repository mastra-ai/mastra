import { Either } from "./helpers/types.js";
import { SupportedFrameworkName } from "./types.js";
import { ServeHandlerOptions } from "./components/InngestCommHandler.js";

//#region src/cloudflare.d.ts

/**
 * The name of the framework, used to identify the framework in Inngest
 * dashboards and during testing.
 */
declare const frameworkName: SupportedFrameworkName;
/**
 * Expected arguments for a Cloudflare Pages Function.
 */
type PagesHandlerArgs = [{
  request: Request;
  env: Record<string, string | undefined>;
}];
/**
 * Expected arguments for a Cloudflare Worker.
 */
type WorkersHandlerArgs = [Request, Record<string, string | undefined>];
/**
 * In Cloudflare, serve and register any declared functions with Inngest, making
 * them available to be triggered by events.
 *
 * @example Cloudflare Pages
 * ```ts
 * import { serve } from "inngest/cloudflare";
 * import { inngest } from "../../inngest/client";
 * import fnA from "../../inngest/fnA"; // Your own function
 *
 * export const onRequest = serve({
 *   client: inngest,
 *   functions: [fnA],
 * });
 * ```
 *
 * @example Cloudflare Workers
 * ```ts
 * import { serve } from "inngest/cloudflare";
 * import { inngest } from "../../inngest/client";
 * import fnA from "../../inngest/fnA"; // Your own function
 *
 * export default {
 *   fetch: serve({
 *     client: inngest,
 *     functions: [fnA],
 *   }),
 * };
 * ```
 *
 * @public
 */
declare const serve: (options: ServeHandlerOptions) => ((...args: Either<PagesHandlerArgs, WorkersHandlerArgs>) => Promise<Response>);
//#endregion
export { PagesHandlerArgs, WorkersHandlerArgs, frameworkName, serve };
//# sourceMappingURL=cloudflare.d.ts.map