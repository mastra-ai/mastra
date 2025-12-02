import { MaybePromise } from "../../helpers/types.cjs";
import { ExecutionResult, IInngestExecution, InngestExecution, InngestExecutionFactory, InngestExecutionOptions, MemoizedOp } from "./InngestExecution.cjs";
import { RunHookStack } from "../InngestMiddleware.cjs";
import { HashedOp, OpStack, StepOpCode } from "../../types.cjs";

//#region src/components/execution/v0.d.ts
declare namespace v0_d_exports {
  export { UnhashedOp, V0ExecutionState, V0InngestExecution, _internals, createV0InngestExecution };
}
declare const createV0InngestExecution: InngestExecutionFactory;
declare class V0InngestExecution extends InngestExecution implements IInngestExecution {
  private state;
  private execution;
  private userFnToRun;
  private fnArg;
  constructor(options: InngestExecutionOptions);
  start(): Promise<ExecutionResult>;
  private _start;
  private initializeMiddleware;
  private createExecutionState;
  get ops(): Record<string, MemoizedOp>;
  private getUserFnToRun;
  private createFnArg;
  /**
   * Using middleware, transform input before running.
   */
  private transformInput;
  private getEarlyExecRunStep;
  /**
   * Using middleware, transform output before returning.
   */
  private transformOutput;
}
interface TickOp extends HashedOp {
  rawArgs: unknown[];
  fn?: (...args: unknown[]) => unknown;
  fulfilled: boolean;
  resolve: (value: MaybePromise<unknown>) => void;
  reject: (reason?: unknown) => void;
}
interface V0ExecutionState {
  /**
   * The tree of all found ops in the entire invocation.
   */
  allFoundOps: Record<string, TickOp>;
  /**
   * All synchronous operations found in this particular tick. The array is
   * reset every tick.
   */
  tickOps: Record<string, TickOp>;
  /**
   * A hash of operations found within this tick, with keys being the hashed
   * ops themselves (without a position) and the values being the number of
   * times that op has been found.
   *
   * This is used to provide some mutation resilience to the op stack,
   * allowing us to survive same-tick mutations of code by ensuring per-tick
   * hashes are based on uniqueness rather than order.
   */
  tickOpHashes: Record<string, number>;
  /**
   * Tracks the current operation being processed. This can be used to
   * understand the contextual parent of any recorded operations.
   */
  currentOp: TickOp | undefined;
  /**
   * If we've found a user function to run, we'll store it here so a component
   * higher up can invoke and await it.
   */
  userFnToRun?: (...args: unknown[]) => unknown;
  /**
   * A boolean to represent whether the user's function is using any step
   * tools.
   *
   * If the function survives an entire tick of the event loop and hasn't
   * touched any tools, we assume that it is a single-step async function and
   * should be awaited as usual.
   */
  hasUsedTools: boolean;
  /**
   * A function that should be used to reset the state of the tools after a
   * tick has completed.
   */
  reset: () => void;
  /**
   * If `true`, any use of step tools will, by default, throw an error. We do
   * this when we detect that a function may be mixing step and non-step code.
   *
   * Created step tooling can decide how to manually handle this on a
   * case-by-case basis.
   *
   * In the future, we can provide a way for a user to override this if they
   * wish to and understand the danger of side-effects.
   *
   * Defaults to `false`.
   */
  nonStepFnDetected: boolean;
  /**
   * When true, we are currently executing a user's code for a single step
   * within a step function.
   */
  executingStep: boolean;
  /**
   * Initialized middleware hooks for this execution.
   *
   * Middleware hooks are cached to ensure they can only be run once, which
   * means that these hooks can be called in many different places to ensure we
   * handle all possible execution paths.
   */
  hooks?: RunHookStack;
  /**
   * The op stack to pass to the function as state, likely stored in
   * `ctx._state` in the Inngest payload.
   *
   * This must be provided in order to always be cognizant of step function
   * state and to allow for multi-step functions.
   */
  opStack: OpStack;
}
/**
 * An operation ready to hash to be used to memoise step function progress.
 *
 * @internal
 */
type UnhashedOp = {
  name: string;
  op: StepOpCode;
  opts: Record<string, unknown> | null;
  parent: string | null;
  pos?: number;
};
/**
 * Exported for testing.
 */
declare const _internals: {
  hashData: (op: UnhashedOp) => string;
};
//#endregion
export { v0_d_exports };
//# sourceMappingURL=v0.d.cts.map