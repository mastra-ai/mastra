/**
 * Error names that the tool-call step RE-THROWS instead of converting into a
 * tool-error result the model can see (see the catch handler in
 * `tool-call-step.ts`).
 *
 * Kept in its own dependency-free module so consumers outside the loop (e.g.
 * dataset experiment tool replay, which must never re-use these names for
 * replayed errors) can import the source of truth without pulling in the
 * execution module graph.
 */
export const RETHROWN_TOOL_ERROR_NAMES: ReadonlySet<string> = new Set(['FGADeniedError']);
