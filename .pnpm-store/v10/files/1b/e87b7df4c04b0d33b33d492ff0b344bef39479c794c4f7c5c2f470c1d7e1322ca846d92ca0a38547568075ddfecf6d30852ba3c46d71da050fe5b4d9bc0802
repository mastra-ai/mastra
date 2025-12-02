import { Context, StepOptions } from "../../types.cjs";
import { Inngest } from "../Inngest.cjs";

//#region src/components/execution/als.d.ts
interface AsyncContext {
  /**
   * The Inngest App that is currently being used to execute the function.
   */
  app: Inngest.Like;
  /**
   * The `ctx` object that has been passed in to this function execution,
   * including values such as `step` and `event`.
   */
  ctx: Context.Any;
  /**
   * If present, this indicates we are currently executing a `step.run()` step's
   * callback. Useful to understand whether we are in the context of a step
   * execution or within the main function body.
   */
  executingStep?: StepOptions;
}
/**
 * Retrieve the async context for the current execution.
 */
declare const getAsyncCtx: () => Promise<AsyncContext | undefined>;
//#endregion
export { AsyncContext, getAsyncCtx };
//# sourceMappingURL=als.d.cts.map