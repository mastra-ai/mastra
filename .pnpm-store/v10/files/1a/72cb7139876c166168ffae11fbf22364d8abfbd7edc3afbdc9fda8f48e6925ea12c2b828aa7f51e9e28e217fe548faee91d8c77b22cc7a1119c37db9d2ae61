import { Either } from "./helpers/types.cjs";
import { SupportedFrameworkName } from "./types.cjs";
import { ServeHandlerOptions } from "./components/InngestCommHandler.cjs";
import { APIGatewayEvent, APIGatewayProxyEventV2, APIGatewayProxyResult, Context } from "aws-lambda";

//#region src/lambda.d.ts

/**
 * The name of the framework, used to identify the framework in Inngest
 * dashboards and during testing.
 */
declare const frameworkName: SupportedFrameworkName;
/**
 * With AWS Lambda, serve and register any declared functions with Inngest,
 * making them available to be triggered by events.
 *
 * @example
 *
 * ```ts
 * import { Inngest } from "inngest";
 * import { serve } from "inngest/lambda";
 *
 * const inngest = new Inngest({ id: "my-lambda-app" });
 *
 * const fn = inngest.createFunction(
 *   { id: "hello-world" },
 *   { event: "test/hello.world" },
 *   async ({ event }) => {
 *    return "Hello World";
 *  }
 * );
 *
 * export const handler = serve({ client: inngest, functions: [fn] });
 * ```
 *
 * @public
 */
declare const serve: (options: ServeHandlerOptions) => ((event: Either<APIGatewayEvent, APIGatewayProxyEventV2>, _context: Context) => Promise<APIGatewayProxyResult>);
//#endregion
export { frameworkName, serve };
//# sourceMappingURL=lambda.d.cts.map