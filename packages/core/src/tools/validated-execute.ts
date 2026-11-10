/**
 * Internal entry point on `Tool` that runs the tool with input the caller has
 * already validated against the tool's input schema (the schema's output).
 *
 * Deliberately a local `Symbol()` rather than `Symbol.for()`: only callers from
 * this copy of `@mastra/core` can reach it, so a `Tool` from another copy is
 * called through its public `execute` and validates its input itself.
 */
export const EXECUTE_VALIDATED = Symbol('mastra.core.tool.executeValidated');

export type ExecuteValidated = (inputData: unknown, context?: unknown) => Promise<unknown>;

export type ExecuteValidatedEntry = {
  /** The public `execute` the tool was constructed with. */
  execute: unknown;
  run: ExecuteValidated;
};

/**
 * Returns the validated entry point, unless the tool's public `execute` was
 * replaced (wrapped, spied on, reassigned): callers must then go through it.
 */
export function getExecuteValidated(tool: unknown): ExecuteValidated | undefined {
  if (typeof tool !== 'object' || tool === null) return undefined;
  const entry = (tool as { [EXECUTE_VALIDATED]?: ExecuteValidatedEntry })[EXECUTE_VALIDATED];
  if (!entry || entry.execute !== (tool as { execute?: unknown }).execute) return undefined;
  return entry.run;
}
