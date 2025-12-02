declare namespace ServerTiming_d_exports {
  export { ServerTiming };
}
/**
 * A class to manage timing functions and arbitrary periods of time before
 * generating a `Server-Timing` header for use in HTTP responses.
 *
 * This is a very simple implementation that does not support nested timings or
 * fractions of a millisecond.
 */
declare class ServerTiming {
  private timings;
  /**
   * Start a timing. Returns a function that, when called, will stop the timing
   * and add it to the header.
   */
  start(name: string, description?: string): () => void;
  /**
   * Add a piece of arbitrary, untimed information to the header. Common use
   * cases would be cache misses.
   *
   * @example
   * ```
   * timer.append("cache", "miss");
   * ```
   */
  append(key: string, value: string): void;
  /**
   * Wrap a function in a timing. The timing will be stopped and added to the
   * header when the function resolves or rejects.
   *
   * The return value of the function will be returned from this function.
   */
  wrap<T extends (...args: unknown[]) => unknown>(name: string, fn: T, description?: string): Promise<Awaited<ReturnType<T>>>;
  /**
   * Generate the `Server-Timing` header.
   */
  getHeader(): string;
}
//#endregion
export { ServerTiming, ServerTiming_d_exports };
//# sourceMappingURL=ServerTiming.d.cts.map