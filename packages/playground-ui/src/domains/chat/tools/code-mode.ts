export interface CodeModeResult {
  success: boolean;
  result?: unknown;
  logs?: string[];
  error?: { message: string; name?: string; line?: number };
}

/**
 * Detects whether a tool call is a Code Mode (`execute_typescript`) call by its
 * shape rather than its id, since the id is configurable via `createCodeMode({ id })`.
 *
 * A Code Mode call has a single string `code` argument, and — once it has run —
 * a result matching `CodeModeResult` (`success: boolean` plus `result`/`logs`/`error`).
 */
export const getCodeModeCall = (
  args: Record<string, unknown> | string,
  result: unknown,
): { code: string; result?: CodeModeResult } | null => {
  let parsedArgs: Record<string, unknown>;
  try {
    parsedArgs = typeof args === 'object' ? args : JSON.parse(args);
  } catch {
    return null;
  }

  const code = parsedArgs?.code;
  if (typeof code !== 'string') return null;

  // Before the program runs, there is no result yet — still render as Code Mode.
  if (result === undefined || result === null) {
    return { code };
  }

  if (
    typeof result === 'object' &&
    typeof (result as CodeModeResult).success === 'boolean' &&
    ('result' in result || 'logs' in result || 'error' in result)
  ) {
    return { code, result: result as CodeModeResult };
  }

  return null;
};
