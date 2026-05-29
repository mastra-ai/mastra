import { WORKFLOW_SNAPSHOT_SERIALIZER } from '../stream/aisdk/v5/output-helpers';

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
    const serialized = value.map(item => serializeWorkflowSnapshotValue(item, seen));
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
