//#region src/components/StepError.d.ts
/**
 * An error that represents a step exhausting all retries and failing. This is
 * thrown by an Inngest step if it fails.
 *
 * It's synonymous with an `Error`, with the addition of the `stepId` that
 * failed.
 *
 * @public
 */
declare class StepError extends Error {
  /**
   * The ID of the step that failed.
   */
  readonly stepId: string;
  cause?: unknown;
  constructor(
  /**
   * The ID of the step that failed.
   */
  stepId: string, err: unknown);
}
//#endregion
export { StepError };
//# sourceMappingURL=StepError.d.ts.map