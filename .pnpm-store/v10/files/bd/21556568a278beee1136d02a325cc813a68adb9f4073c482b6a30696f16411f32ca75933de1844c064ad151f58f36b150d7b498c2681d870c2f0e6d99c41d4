import { SupportedFrameworkName } from "./types.js";
import { ServeHandlerOptions } from "./components/InngestCommHandler.js";
import { APIGatewayProxyEvent, Context } from "aws-lambda";

//#region src/redwood.d.ts

interface RedwoodResponse {
  statusCode: number;
  body?: string | null;
  headers?: Record<string, string>;
}
/**
 * The name of the framework, used to identify the framework in Inngest
 * dashboards and during testing.
 */
declare const frameworkName: SupportedFrameworkName;
/**
 * In Redwood.js, serve and register any declared functions with Inngest, making
 * them available to be triggered by events.
 *
 * @example
 * ```ts
 * import { serve } from "inngest/redwood";
 * import { inngest } from "src/inngest/client";
 * import fnA from "src/inngest/fnA"; // Your own function
 *
 * export const handler = serve({
 *   client: inngest,
 *   functions: [fnA],
 *   servePath: "/api/inngest",
 * });
 * ```
 *
 * @public
 */
declare const serve: (options: ServeHandlerOptions) => ((event: APIGatewayProxyEvent, _context: Context) => Promise<RedwoodResponse>);
//#endregion
export { RedwoodResponse, frameworkName, serve };
//# sourceMappingURL=redwood.d.ts.map