//#region src/components/RetryAfterError.d.ts
/**
 * An error that, when thrown, indicates to Inngest that the function should be
 * retried after a given amount of time.
 *
 * A `message` must be provided, as well as a `retryAfter` parameter, which can
 * be a `number` of milliseconds, an `ms`-compatible time string, or a `Date`.
 *
 * An optional `cause` can be provided to provide more context to the error.
 *
 * @public
 */
declare class RetryAfterError extends Error {
  /**
   * The underlying cause of the error, if any.
   *
   * This will be serialized and sent to Inngest.
   */
  readonly cause?: unknown;
  /**
   * The time after which the function should be retried. Represents either a
   * number of milliseconds or a RFC3339 date.
   */
  readonly retryAfter: string;
  constructor(message: string,
  /**
   * The time after which the function should be retried. Represents either a
   * number of milliseconds or a RFC3339 date.
   */
  retryAfter: number | string | Date, options?: {
    /**
     * The underlying cause of the error, if any.
     *
     * This will be serialized and sent to Inngest.
     */
    cause?: unknown;
  });
}
//#endregion
export { RetryAfterError };
//# sourceMappingURL=RetryAfterError.d.cts.map