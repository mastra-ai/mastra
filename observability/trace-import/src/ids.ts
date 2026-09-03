import { createHash } from 'node:crypto';

function stableId(parts: string[], length: 16 | 32): string {
  return createHash('sha256').update(parts.join('\0')).digest('hex').slice(0, length);
}

export function createTargetTraceId(projectId: string, sourceTraceId: string): string {
  return stableId(['langfuse', projectId, 'trace', sourceTraceId], 32);
}

export function createTargetSpanId(projectId: string, sourceObservationId: string): string {
  return stableId(['langfuse', projectId, 'observation', sourceObservationId], 16);
}
