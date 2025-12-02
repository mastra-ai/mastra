import { Expect, IsEqual, IsLiteral, IsStringLiteral, MaybePromise, Realtime, Simplify } from "./types.js";
import * as inngest0 from "inngest";
import { InngestMiddleware } from "inngest";
import * as inngest_types0 from "inngest/types";

//#region src/middleware.d.ts
declare const realtimeMiddleware: () => InngestMiddleware<{
  name: string;
  init({
    client
  }: {
    client: inngest0.Inngest.Any;
    fn?: inngest0.InngestFunction.Any;
  }): {
    onFunctionRun({
      ctx: {
        runId
      }
    }: Readonly<{
      readonly steps: Readonly<inngest_types0.IncomingOp>[];
      readonly fn: inngest0.InngestFunction.Any;
      readonly reqArgs: Readonly<unknown[]>;
      ctx: Readonly<{
        event: inngest0.EventPayload;
        runId: string;
      }>;
    }>): {
      transformInput({
        ctx: {
          step
        }
      }: Readonly<{
        ctx: Record<string, unknown> & Readonly<inngest0.BaseContext<inngest0.Inngest.Any, inngest_types0.TriggersFromClient<inngest0.Inngest.Any>>>;
        steps: Readonly<inngest_types0.IncomingOp>[];
        fn: inngest0.InngestFunction.Any;
        reqArgs: Readonly<unknown[]>;
      }>): {
        ctx: {
          /**
           * TODO
           */
          publish: Realtime.PublishFn;
        };
      };
    };
  };
}>;
//#endregion
export { Expect, IsEqual, IsLiteral, IsStringLiteral, MaybePromise, Realtime, Simplify, realtimeMiddleware };
//# sourceMappingURL=middleware.d.ts.map