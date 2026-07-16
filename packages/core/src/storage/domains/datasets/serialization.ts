import { MastraError } from '../../../error';
import type { DatasetItemPayload } from '../../types';

function formatPath(parent: string, key: string): string {
  return /^[A-Za-z_$][\w$]*$/.test(key) ? `${parent}.${key}` : `${parent}[${JSON.stringify(key)}]`;
}

function findCircularReference(
  value: unknown,
  path: string,
  ancestors: WeakMap<object, string>,
): { path: string; referencePath: string } | undefined {
  if (value === null || typeof value !== 'object') return undefined;

  const referencePath = ancestors.get(value);
  if (referencePath) return { path, referencePath };

  ancestors.set(value, path);
  try {
    if (Array.isArray(value)) {
      for (const [index, item] of value.entries()) {
        const circularReference = findCircularReference(item, `${path}[${index}]`, ancestors);
        if (circularReference) return circularReference;
      }
    } else {
      for (const key of Object.keys(value)) {
        const circularReference = findCircularReference(
          (value as Record<string, unknown>)[key],
          formatPath(path, key),
          ancestors,
        );
        if (circularReference) return circularReference;
      }
    }
  } finally {
    ancestors.delete(value);
  }

  return undefined;
}

export function validateDatasetItemPayloadSerialization(payload: Partial<DatasetItemPayload>, path: string): void {
  const circularReference = findCircularReference(payload, path, new WeakMap());
  if (circularReference) {
    throw new MastraError({
      id: 'DATASET_ITEM_PAYLOAD_NOT_SERIALIZABLE',
      text: `Dataset item payload must be JSON-serializable: circular reference at ${circularReference.path} references ${circularReference.referencePath}.`,
      domain: 'STORAGE',
      category: 'USER',
      details: circularReference,
    });
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
