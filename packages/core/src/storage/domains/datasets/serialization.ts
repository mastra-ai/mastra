import { MastraError } from '../../../error';
import type { DatasetItemPayload, UpdateDatasetItemInput } from '../../types';

interface SerializationIssue {
  path: string;
  reason: string;
  referencePath?: string;
}

function formatPath(parent: string, key: string): string {
  return /^[A-Za-z_$][\w$]*$/.test(key) ? `${parent}.${key}` : `${parent}[${JSON.stringify(key)}]`;
}

function findSerializationIssue(
  value: unknown,
  path: string,
  ancestors: WeakMap<object, string>,
): SerializationIssue | undefined {
  switch (typeof value) {
    case 'undefined':
      return { path, reason: `undefined value at ${path} would be silently dropped or nulled` };
    case 'function':
      return { path, reason: `function at ${path} would be silently dropped` };
    case 'symbol':
      return { path, reason: `symbol at ${path} would be silently dropped` };
    case 'bigint':
      return { path, reason: `bigint at ${path} cannot be serialized` };
    case 'number':
      return Number.isFinite(value)
        ? undefined
        : { path, reason: `non-finite number ${value} at ${path} would become null` };
  }

  if (value === null || typeof value !== 'object') return undefined;

  const referencePath = ancestors.get(value);
  if (referencePath) {
    return { path, referencePath, reason: `circular reference at ${path} references ${referencePath}` };
  }

  if (!Array.isArray(value)) {
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) {
      // Date, Map, Set, class instances, custom toJSON() objects, etc. change
      // shape during JSON persistence, so identical retries would no longer
      // deep-equal the persisted payload. Require explicit conversion instead.
      const constructorName = (value as object).constructor?.name || 'unknown class';
      return { path, reason: `non-plain object (${constructorName}) at ${path} would change during JSON persistence` };
    }
  }

  ancestors.set(value, path);
  try {
    if (Array.isArray(value)) {
      for (const [index, item] of value.entries()) {
        const issue = findSerializationIssue(item, `${path}[${index}]`, ancestors);
        if (issue) return issue;
      }
    } else {
      for (const key of Object.keys(value)) {
        const issue = findSerializationIssue((value as Record<string, unknown>)[key], formatPath(path, key), ancestors);
        if (issue) return issue;
      }
    }
  } finally {
    ancestors.delete(value);
  }

  return undefined;
}

type SerializableDatasetItemPayload = Partial<Omit<DatasetItemPayload, 'scorerIds'>> &
  Pick<UpdateDatasetItemInput, 'scorerIds'>;

export function validateDatasetItemPayloadSerialization(payload: SerializableDatasetItemPayload, path: string): void {
  const ancestors = new WeakMap<object, string>();
  ancestors.set(payload, path);

  for (const key of Object.keys(payload)) {
    const fieldValue = (payload as Record<string, unknown>)[key];
    // Omitted optional fields: only nested undefined values are lossy.
    if (fieldValue === undefined) continue;

    const issue = findSerializationIssue(fieldValue, formatPath(path, key), ancestors);
    if (issue) {
      throw new MastraError({
        id: 'DATASET_ITEM_PAYLOAD_NOT_SERIALIZABLE',
        text: `Dataset item payload must be JSON-serializable: ${issue.reason}.`,
        domain: 'STORAGE',
        category: 'USER',
        details: issue.referencePath
          ? { path: issue.path, referencePath: issue.referencePath }
          : { path: issue.path, reason: issue.reason },
      });
    }
  }

  try {
    JSON.stringify(payload);
  } catch (error) {
    throw new MastraError({
      id: 'DATASET_ITEM_PAYLOAD_NOT_SERIALIZABLE',
      text: `Dataset item payload at ${path} must be JSON-serializable: ${error instanceof Error ? error.message : String(error)}`,
      domain: 'STORAGE',
      category: 'USER',
      details: { path },
    });
  }
}
