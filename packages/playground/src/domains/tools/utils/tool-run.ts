/** Runs a tool with the given input and request context; a rejection is shown as an error response. */
export type ExecuteTool = (data: unknown, requestContext?: Record<string, unknown>) => Promise<unknown>;

/** A tool's run mutation as the Playground reads it: how to run it, and the mutation's own state. */
export interface ToolExecution {
  execute: ExecuteTool;
  status: 'idle' | 'pending' | 'success' | 'error';
  output: unknown;
  error: Error | null;
}

export type ToolRun =
  | { status: 'success'; output: unknown; durationMs: number }
  | { status: 'error'; error: string; durationMs: number };

export function formatDuration(durationMs: number): string {
  if (durationMs < 1000) return `${Math.round(durationMs)} ms`;
  return `${(durationMs / 1000).toFixed(2)} s`;
}

function formatOutput(output: unknown): string {
  // `undefined` has no JSON form; show it the way the tool returned it.
  if (output === undefined) return 'undefined';
  return JSON.stringify(output, null, 2);
}

/** The text shown (and copied) for a run: pretty JSON output, or the error payload. */
export function getRunCode(run: ToolRun): string {
  if (run.status === 'error') return run.error;
  return formatOutput(run.output);
}

/** The last finished run, from the mutation's state plus how long it took. */
export function toToolRun(
  { status, output, error }: ToolExecution,
  durationMs: number | undefined,
): ToolRun | undefined {
  if (durationMs === undefined) return undefined;
  if (status === 'success') return { status: 'success', output, durationMs };
  if (status === 'error') return { status: 'error', error: describeRunError(error), durationMs };
  return undefined;
}

export function describeRunError(error: unknown): string {
  if (error instanceof Error) return JSON.stringify({ error: error.message }, null, 2);
  return JSON.stringify({ error: String(error) }, null, 2);
}
