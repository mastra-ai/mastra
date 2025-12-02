import { SupportedFrameworkName } from "./types.js";
import { ServeHandlerOptions } from "./components/InngestCommHandler.js";

//#region src/edge.d.ts

/**
 * The name of the framework, used to identify the framework in Inngest
 * dashboards and during testing.
 */
declare const frameworkName: SupportedFrameworkName;
/**
 * In an edge runtime, serve and register any declared functions with Inngest,
 * making them available to be triggered by events.
 *
 * The edge runtime is a generic term for any serverless runtime that supports
 * only standard Web APIs such as `fetch`, `Request`, and `Response`, such as
 * Cloudflare Workers, Vercel Edge Functions, and AWS Lambda@Edge.
 *
 * @example
 * ```ts
 * import { serve } from "inngest/edge";
 * import functions from "~/inngest";
 *
 * export const handler = serve({ id: "my-edge-app", functions });
 * ```
 *
 * @public
 */
declare const serve: (options: ServeHandlerOptions) => ((req: Request) => Promise<Response>);
//#endregion
export { frameworkName, serve };
//# sourceMappingURL=edge.d.ts.map