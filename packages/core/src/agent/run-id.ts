export function resolveRunId(runId: string | undefined, generateId?: () => string | undefined): string {
  return runId ?? generateId?.() ?? globalThis.crypto.randomUUID();
}
