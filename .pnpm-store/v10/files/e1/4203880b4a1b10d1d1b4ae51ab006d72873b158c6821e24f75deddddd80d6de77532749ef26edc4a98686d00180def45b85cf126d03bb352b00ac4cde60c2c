import { SupportedFrameworkName } from "./types.js";
import { ServeHandlerOptions } from "./components/InngestCommHandler.js";
import { NextRequest } from "next/server";

//#region src/next.d.ts

/**
 * The name of the framework, used to identify the framework in Inngest
 * dashboards and during testing.
 */
declare const frameworkName: SupportedFrameworkName;
/**
 * The shape of a request handler, supporting Next.js 12+.
 *
 * We are intentionally abstract with the arguments here, as Next.js's type
 * checking when building varies wildly between major versions; specifying
 * different types (even optional types) here can cause issues with the build.
 *
 * This change was initially made for Next.js 15, which specifies the second
 * argument as `RouteContext`, whereas Next.js 13 and 14 omit it and Next.js 12
 * provides a `NextApiResponse`, which is varies based on the execution
 * environment used (edge vs serverless).
 */
type RequestHandler = (expectedReq: NextRequest, res: unknown) => Promise<Response>;
/**
 * In Next.js, serve and register any declared functions with Inngest, making
 * them available to be triggered by events.
 *
 * Supports Next.js 12+, both serverless and edge.
 *
 * @example Next.js <=12 or the pages router can export the handler directly
 * ```ts
 * export default serve({ client: inngest, functions: [fn1, fn2] });
 * ```
 *
 * @example Next.js >=13 with the `app` dir must export individual methods
 * ```ts
 * export const { GET, POST, PUT } = serve({
 *            client: inngest,
 *            functions: [fn1, fn2],
 * });
 * ```
 *
 * @public
 */
declare const serve: (options: ServeHandlerOptions) => RequestHandler & {
  GET: RequestHandler;
  POST: RequestHandler;
  PUT: RequestHandler;
};
//#endregion
export { RequestHandler, frameworkName, serve };
//# sourceMappingURL=next.d.ts.map