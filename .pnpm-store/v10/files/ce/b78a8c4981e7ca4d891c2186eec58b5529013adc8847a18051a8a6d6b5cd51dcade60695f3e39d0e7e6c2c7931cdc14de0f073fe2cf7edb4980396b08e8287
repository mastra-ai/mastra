import { SupportedFrameworkName } from "./types.js";
import { ServeHandlerOptions } from "./components/InngestCommHandler.js";
import { EventHandlerRequest, H3Event } from "h3";

//#region src/h3.d.ts

/**
 * The name of the framework, used to identify the framework in Inngest
 * dashboards and during testing.
 */
declare const frameworkName: SupportedFrameworkName;
/**
 * In h3, serve and register any declared functions with Inngest, making
 * them available to be triggered by events.
 *
 * @example
 * ```ts
 * import { createApp, eventHandler, toNodeListener } from "h3";
 * import { serve } from "inngest/h3";
 * import { createServer } from "node:http";
 * import { inngest } from "./inngest/client";
 * import fnA from "./inngest/fnA";
 *
 * const app = createApp();
 * app.use(
 *   "/api/inngest",
 *   eventHandler(
 *     serve({
 *       client: inngest,
 *       functions: [fnA],
 *     })
 *   )
 * );
 *
 * createServer(toNodeListener(app)).listen(process.env.PORT || 3000);
 * ```
 *
 * @public
 */
declare const serve: (options: ServeHandlerOptions) => ((event: H3Event<EventHandlerRequest>) => Promise<void>);
//#endregion
export { frameworkName, serve };
//# sourceMappingURL=h3.d.ts.map