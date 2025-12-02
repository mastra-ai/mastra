import { Simplify } from "../../helpers/types.js";
import { InngestExecutionFactory, MemoizedOp } from "./InngestExecution.js";
import { RunHookStack } from "../InngestMiddleware.js";
import { FoundStep } from "../InngestStepTools.js";
import { OutgoingOp } from "../../types.js";
import { StepError } from "../StepError.js";

//#region src/components/execution/v1.d.ts
declare namespace v1_d_exports {
  export { Checkpoints, V1ExecutionState, _internals, createV1InngestExecution };
}
declare const createV1InngestExecution: InngestExecutionFactory;
/**
 * Types of checkpoints that can be reached during execution.
 */
interface Checkpoints {
  "steps-found": {
    steps: [FoundStep, ...FoundStep[]];
  };
  "function-rejected": {
    error: unknown;
  };
  "function-resolved": {
    data: unknown;
  };
  "step-not-found": {
    step: OutgoingOp;
  };
}
type Checkpoint = { [K in keyof Checkpoints]: Simplify<{
  type: K;
} & Checkpoints[K]> }[keyof Checkpoints];
interface V1ExecutionState {
  /**
   * A value that indicates that we're executing this step. Can be used to
   * ensure steps are not accidentally nested until we support this across all
   * platforms.
   */
  executingStep?: Readonly<Omit<OutgoingOp, "id">>;
  /**
   * A map of step IDs to their data, used to fill previously-completed steps
   * with state from the executor.
   */
  stepState: Record<string, MemoizedOp>;
  /**
   * The number of steps we expect to fulfil based on the state passed from the
   * Executor.
   */
  stepsToFulfill: number;
  /**
   * A map of step IDs to their functions to run. The executor can request a
   * specific step to run, so we need to store the function to run here.
   */
  steps: Map<string, FoundStep>;
  /**
   * A flag which represents whether or not steps are understood to be used in
   * this function. This is used to determine whether or not we should run
   * some steps (such as `step.sendEvent`) inline as they are found.
   */
  hasSteps: boolean;
  /**
   * The core loop - a generator used to take an action upon finding the next
   * checkpoint. Manages the flow of execution and cleaning up after itself.
   */
  loop: AsyncGenerator<Checkpoint, void, void>;
  /**
   * A function that resolves the `Promise` returned by `waitForNextDecision`.
   */
  setCheckpoint: (data: Checkpoint) => void;
  /**
   * Initialized middleware hooks for this execution.
   *
   * Middleware hooks are cached to ensure they can only be run once, which
   * means that these hooks can be called in many different places to ensure we
   * handle all possible execution paths.
   */
  hooks?: RunHookStack;
  /**
   * Returns whether or not all state passed from the executor has been used to
   * fulfill found steps.
   */
  allStateUsed: () => boolean;
  /**
   * An ordered list of step IDs that represents the order in which their
   * execution was completed.
   */
  stepCompletionOrder: string[];
  /**
   * An set of step IDs that have yet to be seen in this execution. Used to
   * decide when to trigger middleware based on the current state.
   */
  remainingStepsToBeSeen: Set<string>;
  /**
   * If defined, this is the error that purposefully thrown when memoizing step
   * state in order to support per-step errors.
   *
   * We use this so that if the function itself rejects with the same error, we
   * know that it was entirely uncaught (or at the very least rethrown), so we
   * should send a `NonRetriableError` to stop needless execution of a function
   * that will continue to fail.
   *
   * TODO This is imperfect, as this state is currently kept around for longer
   * than it needs to be. It should disappear as soon as we've seen that the
   * error did not immediately throw. It may need to be refactored to work a
   * little more smoothly with the core loop.
   */
  recentlyRejectedStepError?: StepError;
}
/**
 * Exported for testing.
 */
declare const _internals: {
  hashOp: (op: OutgoingOp) => OutgoingOp;
  hashId: (id: string) => string;
};
//#endregion
export { v1_d_exports };
//# sourceMappingURL=v1.d.ts.map