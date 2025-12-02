import { InngestMiddleware } from "../../InngestMiddleware.cjs";
import { InngestFunction } from "../../InngestFunction.cjs";
import { Inngest } from "../../Inngest.cjs";
import { Behaviour, Instrumentations } from "./util.cjs";
import * as _opentelemetry_api0 from "@opentelemetry/api";
import { DiagLogLevel } from "@opentelemetry/api";

//#region src/components/execution/otel/middleware.d.ts
/**
 * A set of options for the OTel middleware.
 */
interface OTelMiddlewareOptions {
  /**
   * The behaviour of the OTel middleware. This controls whether the
   * middleware will create a new OTel provider, extend an existing one, or
   * do nothing. The default is "auto", which will attempt to extend an
   * existing provider, and if that fails, create a new one.
   *
   * - `"auto"`: Attempt to extend an existing provider, and if that fails,
   *   create a new one.
   * - `"createProvider"`: Create a new OTel provider.
   * - `"extendProvider"`: Attempt to extend an existing provider.
   * - `"off"`: Do nothing.
   */
  behaviour?: Behaviour;
  /**
   * Add additional instrumentations to the OTel provider.
   *
   * Note that these only apply if the provider is created by the middleware;
   * extending an existing provider cannot add instrumentations and it instead
   * must be done wherever the provider is created.
   */
  instrumentations?: Instrumentations;
  /**
   * The log level for the OTel middleware, specifially a diagnostic logger
   * attached to the global OTel provider.
   *
   * Defaults to `DiagLogLevel.ERROR`.
   */
  logLevel?: DiagLogLevel;
}
/**
 * Middleware the captures and exports spans relevant to Inngest runs using
 * OTel.
 *
 * This can be used to attach additional spans and data to the existing traces
 * in your Inngest dashboard (or Dev Server).
 */
declare const otelMiddleware: ({
  behaviour,
  instrumentations,
  logLevel
}?: OTelMiddlewareOptions) => InngestMiddleware<{
  name: string;
  init({
    client
  }: {
    client: Inngest.Any;
    fn?: InngestFunction.Any;
  }): {
    onFunctionRun(): {
      transformInput(): {
        ctx: {
          /**
           * A tracer that can be used to create spans within a step
           * that will be displayed on the Inngest dashboard (or Dev
           * Server).
           *
           * Note that creating spans outside of steps when the function
           * contains `step.*()` calls is not currently supported.
           */
          tracer: _opentelemetry_api0.Tracer;
        };
      };
      beforeResponse(): Promise<void>;
    };
  };
}>;
//#endregion
export { OTelMiddlewareOptions, otelMiddleware };
//# sourceMappingURL=middleware.d.cts.map