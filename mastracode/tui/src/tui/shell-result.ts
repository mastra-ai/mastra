export interface ShellPassthroughResult {
  exitCode?: number | null;
  failed?: boolean;
  stderr?: string;
  shortMessage?: string;
  message?: string;
}

export interface ShellPassthroughCompletion {
  exitCode: number;
  diagnostic?: string;
}

function nonEmptyMessage(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

export function resolveShellPassthroughCompletion(result: ShellPassthroughResult): ShellPassthroughCompletion {
  if (typeof result.exitCode === 'number') {
    return { exitCode: result.exitCode };
  }

  if (!result.failed) {
    return { exitCode: 0 };
  }

  return {
    exitCode: 1,
    diagnostic:
      nonEmptyMessage(result.shortMessage) ?? nonEmptyMessage(result.message) ?? nonEmptyMessage(result.stderr),
  };
}
