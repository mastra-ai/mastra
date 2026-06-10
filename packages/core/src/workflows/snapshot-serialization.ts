/**
 * Symbol-keyed hook objects can implement to control how they are persisted in
 * workflow snapshots (e.g. `DefaultStepResult` persists per-step response
 * message deltas instead of the cumulative history). `Symbol.for` is used so
 * the hook keeps working across duplicated copies of @mastra/core, and so a
 * user object's own `toWorkflowSnapshot` property is never picked up by accident.
 */
export const WORKFLOW_SNAPSHOT_SERIALIZER = Symbol.for('mastra.workflowSnapshotSerializer');

export function serializeWorkflowSnapshotValue(value: any, seen = new WeakSet<object>()): any {
  if (value === null || typeof value !== 'object') {
    return value;
  }

  if (value instanceof Date) {
    return value;
  }

  if (seen.has(value)) {
    return '[Circular]';
  }
  seen.add(value);

  const workflowSnapshotSerializer = value[WORKFLOW_SNAPSHOT_SERIALIZER];
  if (typeof workflowSnapshotSerializer === 'function') {
    const workflowSnapshot = workflowSnapshotSerializer.call(value);
    const serialized =
      workflowSnapshot === value
        ? serializeObjectEntries(value, seen)
        : serializeWorkflowSnapshotValue(workflowSnapshot, seen);
    seen.delete(value);
    return serialized;
  }

  if (typeof value.toJSON === 'function') {
    const jsonValue = value.toJSON();
    const serialized =
      jsonValue === value ? serializeObjectEntries(value, seen) : serializeWorkflowSnapshotValue(jsonValue, seen);
    seen.delete(value);
    return serialized;
  }

  if (Array.isArray(value)) {
    // Match JSON.stringify semantics: functions in arrays become null. Without
    // this, non-JSON writers (e.g. the MongoDB driver) would receive raw functions.
    const serialized = value.map(item =>
      typeof item === 'function' ? null : serializeWorkflowSnapshotValue(item, seen),
    );
    seen.delete(value);
    return serialized;
  }

  const serialized = serializeObjectEntries(value, seen);
  seen.delete(value);
  return serialized;
}

function serializeObjectEntries(value: object, seen: WeakSet<object>): Record<string, any> {
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, nestedValue]) => typeof nestedValue !== 'function')
      .map(([key, nestedValue]) => [key, serializeWorkflowSnapshotValue(nestedValue, seen)]),
  );
}
