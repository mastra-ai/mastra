const PROVIDER_ID = 'langfuse';

export const LANGFUSE_ID_ALGORITHM_VERSION = 'langfuse-sha256-v1';

async function stableHexId(parts: string[], length: 16 | 32): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(parts.join('\0')));
  return Buffer.from(digest).toString('hex').slice(0, length);
}

export function createLangfuseTraceImportId(projectId: string, traceId: string): Promise<string> {
  return stableHexId([PROVIDER_ID, projectId, 'trace', traceId], 32);
}

export function createLangfuseSpanImportId(projectId: string, observationId: string): Promise<string> {
  return stableHexId([PROVIDER_ID, projectId, 'observation', observationId], 16);
}
