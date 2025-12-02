//#region src/components/NonRetriableError.d.ts
/**
 * An error that, when thrown, indicates to Inngest that the function should
 * cease all execution and not retry.
 *
 * A `message` must be provided, and an optional `cause` can be provided to
 * provide more context to the error.
 *
 * @public
 */
declare class NonRetriableError extends Error {
  /**
   * The underlying cause of the error, if any.
   *
   * This will be serialized and sent to Inngest.
   */
  readonly cause?: unknown;
  constructor(message: string, options?: {
    /**
     * The underlying cause of the error, if any.
     *
     * This will be serialized and sent to Inngest.
     */
    cause?: unknown;
  });
}
//#endregion
export { NonRetriableError };
//# sourceMappingURL=NonRetriableError.d.cts.map