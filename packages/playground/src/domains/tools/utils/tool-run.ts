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
  return run.status === 'success' ? formatOutput(run.output) : run.error;
}

export function describeRunError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return JSON.stringify({ error: message }, null, 2);
}
