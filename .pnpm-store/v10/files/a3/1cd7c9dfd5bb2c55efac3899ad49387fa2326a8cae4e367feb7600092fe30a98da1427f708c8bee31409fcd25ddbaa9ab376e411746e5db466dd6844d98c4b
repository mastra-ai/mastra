import { SupportedFrameworkName } from "./types.cjs";
import { ServeHandlerOptions } from "./components/InngestCommHandler.cjs";

//#region src/remix.d.ts

/**
 * The name of the framework, used to identify the framework in Inngest
 * dashboards and during testing.
 */
declare const frameworkName: SupportedFrameworkName;
/**
 * In Remix, serve and register any declared functions with Inngest, making them
 * available to be triggered by events.
 *
 * Remix requires that you export both a "loader" for serving `GET` requests,
 * and an "action" for serving other requests, therefore exporting both is
 * required.
 *
 * See {@link https://remix.run/docs/en/v1/guides/resource-routes}
 *
 * @example
 * ```ts
 * import { serve } from "inngest/remix";
 * import functions from "~/inngest";
 *
 * const handler = serve({ id: "my-remix-app", functions });
 *
 * export { handler as loader, handler as action };
 * ```
 *
 * @public
 */
declare const serve: (options: ServeHandlerOptions) => ((ctx: {
  request: Request;
  context?: unknown;
}) => Promise<Response>);
//#endregion
export { frameworkName, serve };
//# sourceMappingURL=remix.d.cts.map