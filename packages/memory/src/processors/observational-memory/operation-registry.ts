/**
 * Process-level operation registry for Observational Memory.
 *
 * Tracks which operations (reflecting, observing, buffering) are actively running
 * in THIS process. Used to detect stale DB flags left by crashed processes.
 *
 * Key format: `${recordId}:${operationType}`
 */

export type OmOperationName = 'reflecting' | 'observing' | 'bufferingObservation' | 'bufferingReflection';

const activeOps = new Set<string>();

export function opKey(recordId: string, op: OmOperationName): string {
  return `${recordId}:${op}`;
}

export function registerOp(recordId: string, op: OmOperationName): void {
  activeOps.add(opKey(recordId, op));
}

export function unregisterOp(recordId: string, op: OmOperationName): void {
  activeOps.delete(opKey(recordId, op));
}

export function isOpActiveInProcess(recordId: string, op: OmOperationName): boolean {
  return activeOps.has(opKey(recordId, op));
}
