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

export function describeRunError(error: unknown): string {
  if (error instanceof Error) return JSON.stringify({ error: error.message }, null, 2);
  return JSON.stringify({ error: String(error) }, null, 2);
}
