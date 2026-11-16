export function successfulInvocationOutput<T extends { error?: unknown }>(output: T): T {
  if (output.error) {
    throw output.error;
  }
  return output;
}

export async function drainInvocationOutput<T extends { error?: unknown }>(output: {
  getFullOutput(): Promise<T>;
}): Promise<T> {
  return successfulInvocationOutput(await output.getFullOutput());
}

export function resolveInvocationRunId(runId: string | undefined, generateId?: () => string | undefined): string {
  return runId ?? generateId?.() ?? globalThis.crypto.randomUUID();
}
