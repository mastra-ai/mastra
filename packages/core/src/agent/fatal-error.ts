/**
 * FatalError is a sentinel wrapper used to propagate a user-defined error
 * out of a processor or workflow step without being wrapped, re-classed,
 * or serialized by the framework.
 *
 * When `abort.fatal(err)` is called from a processor or a processor-workflow
 * step, the framework throws a `FatalError(err)` internally. The catch
 * blocks in the agent and processor runner detect `FatalError` and re-throw
 * `err` (the original user error instance) to the caller, preserving:
 *   - class identity (`err instanceof MyError` works)
 *   - custom properties (e.g. `err.code`, `err.retryAfterSeconds`)
 *   - the cause chain
 *
 * This is distinct from `TripWire`, which is a structured, recoverable
 * abort signal that the framework converts to a `tripwire` result.
 * `FatalError` is non-recoverable and is intended to surface as a thrown
 * error to the caller of the agent.
 */
export class FatalError extends Error {
  /**
   * The original user-provided error to propagate to the caller.
   */
  public readonly cause: unknown;
  public readonly processorId?: string;

  constructor(cause: unknown, processorId?: string) {
    const message = cause instanceof Error ? cause.message : String(cause ?? 'Fatal abort');
    super(message);
    this.name = 'FatalError';
    this.cause = cause;
    this.processorId = processorId;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Type guard for FatalError. Uses instanceof but also accepts cross-realm
 * instances by matching the `name` field, mirroring the pattern Node.js
 * uses for `AggregateError` and similar built-ins.
 */
export function isFatalError(err: unknown): err is FatalError {
  return (
    err instanceof FatalError ||
    (typeof err === 'object' && err !== null && (err as { name?: unknown }).name === 'FatalError' && 'cause' in err)
  );
}

/**
 * Attach a `.fatal(error)` method to an existing abort callback.
 *
 * Used by processor and processor-workflow infrastructure to upgrade the
 * inline `abort` function each context creates into the public
 * `ProcessorAbortFn` shape (callable + `.fatal()`).
 */
export function attachFatal<T extends (...args: any[]) => never>(
  abort: T,
  processorId?: string,
): T & { fatal: (error: unknown) => never } {
  const fn = abort as T & { fatal: (error: unknown) => never };
  fn.fatal = (error: unknown): never => {
    throw new FatalError(error, processorId);
  };
  return fn;
}
