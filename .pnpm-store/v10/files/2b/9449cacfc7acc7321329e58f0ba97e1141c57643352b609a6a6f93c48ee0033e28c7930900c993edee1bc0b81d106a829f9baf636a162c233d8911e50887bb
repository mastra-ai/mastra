//#region src/helpers/consts.d.ts
/**
 * Keys for accessing query parameters included in requests from Inngest to run
 * functions.
 *
 * Used internally to create handlers using `InngestCommHandler`, but can be
 * imported to be used if creating a custom handler outside of the package.
 *
 * @public
 */
declare enum queryKeys {
  DeployId = "deployId",
  FnId = "fnId",
  Probe = "probe",
  StepId = "stepId",
}
/**
 * Keys for accessing headers included in requests from Inngest to run
 * functions.
 *
 * Used internally to create handlers using `InngestCommHandler`, but can be
 * imported to be used if creating a custom handler outside of the package.
 *
 * @public
 */
declare enum headerKeys {
  ContentLength = "content-length",
  Signature = "x-inngest-signature",
  SdkVersion = "x-inngest-sdk",
  Environment = "x-inngest-env",
  Platform = "x-inngest-platform",
  Framework = "x-inngest-framework",
  NoRetry = "x-inngest-no-retry",
  RequestVersion = "x-inngest-req-version",
  RetryAfter = "retry-after",
  InngestServerKind = "x-inngest-server-kind",
  InngestExpectedServerKind = "x-inngest-expected-server-kind",
  InngestSyncKind = "x-inngest-sync-kind",
  EventIdSeed = "x-inngest-event-id-seed",
  TraceParent = "traceparent",
  TraceState = "tracestate",
}
/**
 * Events that Inngest may send internally that can be used to trigger
 * functions.
 *
 * @public
 */
declare enum internalEvents {
  /**
   * A function has failed after exhausting all available retries. This event
   * will contain the original event and the error that caused the failure.
   */
  FunctionFailed = "inngest/function.failed",
  FunctionInvoked = "inngest/function.invoked",
  FunctionFinished = "inngest/function.finished",
  FunctionCancelled = "inngest/function.cancelled",
  ScheduledTimer = "inngest/scheduled.timer",
}
/**
 * The execution models the SDK is aware of.
 *
 * This is used in a number of places to ensure all execution versions are
 * accounted for for a given operation.
 */
declare enum ExecutionVersion {
  /**
   * Very legacy, initial version of the executor. Uses hashed op objects and
   * `pos` to determine the order of execution and which ops to run.
   *
   * Very stubborn about determinism.
   */
  V0 = 0,
  /**
   * Uses a more flexible approach to execution and is more lenient about
   * determinism, allowing non-step async actions and non-determinism.
   *
   * Nowhere near as stubborn about determinism and so can silently migrate
   * between versions after bug fixes.
   */
  V1 = 1,
  /**
   * Identical to V1, but allows the Executor to optimize parallel calls, hugely
   * reducing traffic going to/from the SDK.
   */
  V2 = 2,
}
//#endregion
export { ExecutionVersion, headerKeys, internalEvents, queryKeys };
//# sourceMappingURL=consts.d.cts.map