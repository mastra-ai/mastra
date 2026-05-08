/**
 * Process-level operation registry for Observational Memory.
 *
 * Tracks which operations (reflecting, observing, buffering) are actively running
 * in THIS process. Used to detect stale DB flags left by crashed processes.
 *
 * Key format: `${recordId}:${operationType}`
 */

export type OmOperationName = 'reflecting' | 'observing' | 'bufferingObservation' | 'bufferingReflection';

const activeOps = new Map<string, number>();

export function opKey(recordId: string, op: OmOperationName): string {
  return `${recordId}:${op}`;
}

export function registerOp(recordId: string, op: OmOperationName): void {
  const key = opKey(recordId, op);
  activeOps.set(key, (activeOps.get(key) ?? 0) + 1);
}

export function unregisterOp(recordId: string, op: OmOperationName): void {
  const key = opKey(recordId, op);
  const count = activeOps.get(key);
  if (!count) return;
  if (count <= 1) {
    activeOps.delete(key);
  } else {
    activeOps.set(key, count - 1);
  }
}

export function isOpActiveInProcess(recordId: string, op: OmOperationName): boolean {
  return (activeOps.get(opKey(recordId, op)) ?? 0) > 0;
}
