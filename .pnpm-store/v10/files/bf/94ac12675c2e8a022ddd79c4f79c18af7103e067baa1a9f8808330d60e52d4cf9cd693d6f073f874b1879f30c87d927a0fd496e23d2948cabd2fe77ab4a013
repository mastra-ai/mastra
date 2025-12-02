import { SupportedFrameworkName } from "./types.cjs";
import { ActionResponse, ServeHandlerOptions } from "./components/InngestCommHandler.cjs";

//#region src/digitalocean.d.ts

type HTTP = {
  headers: Record<string, string>;
  method: string;
  path: string;
};
type Main = {
  http?: HTTP;
  [data: string]: unknown;
} | undefined;
/**
 * The name of the framework, used to identify the framework in Inngest
 * dashboards and during testing.
 */
declare const frameworkName: SupportedFrameworkName;
/**
 * In DigitalOcean Functions, serve and register any declared functions with
 * Inngest, making them available to be triggered by events.
 *
 * @example
 * ```ts
 * import { serve } from "inngest/digitalocean";
 * import { inngest } from "./src/inngest/client";
 * import fnA from "./src/inngest/fnA"; // Your own function
 *
 * const main = serve({
 *   client: inngest,
 *   functions: [fnA],
 *   // Your digitalocean hostname.  This is required otherwise your functions won't work.
 *   serveHost: "https://faas-sfo3-your-url.doserverless.co",
 *   // And your DO path, also required.
 *   servePath: "/api/v1/web/fn-your-uuid/inngest",
 * });
 *
 * // IMPORTANT: Makes the function available as a module in the project.
 * // This is required for any functions that require external dependencies.
 * module.exports.main = main;
 * ```
 *
 * @public
 */
declare const serve: (options: ServeHandlerOptions & Required<Pick<NonNullable<ServeHandlerOptions>, "serveHost">>) => ((main?: Main) => Promise<ActionResponse<string>>);
//#endregion
export { frameworkName, serve };
//# sourceMappingURL=digitalocean.d.cts.map