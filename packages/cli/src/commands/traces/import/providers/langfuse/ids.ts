import { createHash } from 'node:crypto';

const PROVIDER_ID = 'langfuse';

export const LANGFUSE_ID_ALGORITHM_VERSION = 'langfuse-sha256-v1';

function stableHexId(parts: string[], length: 16 | 32): string {
  return createHash('sha256').update(parts.join('\0')).digest('hex').slice(0, length);
}

export function createLangfuseTraceImportId(projectId: string, traceId: string): string {
  return stableHexId([PROVIDER_ID, projectId, 'trace', traceId], 32);
}

export function createLangfuseSpanImportId(projectId: string, observationId: string): string {
  return stableHexId([PROVIDER_ID, projectId, 'observation', observationId], 16);
}
