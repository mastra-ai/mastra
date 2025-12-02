import { ExecutionVersion } from "../../helpers/consts.cjs";
import { MaybePromise, Simplify } from "../../helpers/types.cjs";
import { ServerTiming } from "../../helpers/ServerTiming.cjs";
import { InngestFunction } from "../InngestFunction.cjs";
import { Context, IncomingOp, OutgoingOp } from "../../types.cjs";
import { Inngest } from "../Inngest.cjs";
import { ActionResponse } from "../InngestCommHandler.cjs";
import { Debugger } from "debug";

//#region src/components/execution/InngestExecution.d.ts
declare namespace InngestExecution_d_exports {
  export { ExecutionResult, ExecutionResultHandler, ExecutionResultHandlers, ExecutionResults, ExecutionVersion, IInngestExecution, InngestExecution, InngestExecutionFactory, InngestExecutionOptions, MemoizedOp, PREFERRED_EXECUTION_VERSION };
}
/**
 * The possible results of an execution.
 */
interface ExecutionResults {
  "function-resolved": {
    data: unknown;
  };
  "step-ran": {
    step: OutgoingOp;
    retriable?: boolean | string;
  };
  "function-rejected": {
    error: unknown;
    retriable: boolean | string;
  };
  "steps-found": {
    steps: [OutgoingOp, ...OutgoingOp[]];
  };
  "step-not-found": {
    step: OutgoingOp;
  };
}
type ExecutionResult = { [K in keyof ExecutionResults]: Simplify<{
  type: K;
  ctx: Context.Any;
  ops: Record<string, MemoizedOp>;
} & ExecutionResults[K]> }[keyof ExecutionResults];
type ExecutionResultHandler<T = ActionResponse> = (result: ExecutionResult) => MaybePromise<T>;
type ExecutionResultHandlers<T = ActionResponse> = { [E in ExecutionResult as E["type"]]: (result: E) => MaybePromise<T> };
interface MemoizedOp extends IncomingOp {
  /**
   * If the step has been hit during this run, these will be the arguments
   * passed to it.
   */
  rawArgs?: unknown[];
  fulfilled?: boolean;
  /**
   * The promise that has been returned to userland code.
   */
  promise?: Promise<unknown>;
  seen?: boolean;
}
/**
 * The preferred execution version that will be used by the SDK when handling
 * brand new runs where the Executor is allowing us to choose.
 *
 * Changing this should not ever be a breaking change, as this will only change
 * new runs, not existing ones.
 */
declare const PREFERRED_EXECUTION_VERSION = ExecutionVersion.V1;
/**
 * Options for creating a new {@link InngestExecution} instance.
 */
interface InngestExecutionOptions {
  client: Inngest.Any;
  fn: InngestFunction.Any;
  reqArgs: unknown[];
  runId: string;
  data: Omit<Context.Any, "step">;
  stepState: Record<string, MemoizedOp>;
  stepCompletionOrder: string[];
  /**
   * Headers to be sent with any request to Inngest during this execution.
   */
  headers: Record<string, string>;
  requestedRunStep?: string;
  timer?: ServerTiming;
  isFailureHandler?: boolean;
  disableImmediateExecution?: boolean;
  /**
   * Provide the ability to transform the context passed to the function before
   * the execution starts.
   */
  transformCtx?: (ctx: Readonly<Context.Any>) => Context.Any;
}
type InngestExecutionFactory = (options: InngestExecutionOptions) => IInngestExecution;
declare class InngestExecution {
  protected options: InngestExecutionOptions;
  protected debug: Debugger;
  constructor(options: InngestExecutionOptions);
}
interface IInngestExecution {
  start(): Promise<ExecutionResult>;
}
//#endregion
export { ExecutionResult, IInngestExecution, InngestExecution, InngestExecutionFactory, InngestExecutionOptions, InngestExecution_d_exports, MemoizedOp };
//# sourceMappingURL=InngestExecution.d.cts.map