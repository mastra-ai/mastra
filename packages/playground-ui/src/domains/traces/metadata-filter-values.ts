export const METADATA_FILTER_PREFIX = 'metadata:';

export function getMetadataFilterPath(fieldId: string): string[] | undefined {
  if (!fieldId.startsWith(METADATA_FILTER_PREFIX)) return undefined;
  try {
    const path: unknown = JSON.parse(fieldId.slice(METADATA_FILTER_PREFIX.length));
    if (
      Array.isArray(path) &&
      path.length >= 2 &&
      path[0] === 'metadata' &&
      path.every((segment): segment is string => typeof segment === 'string' && segment.length > 0)
    ) {
      return path;
    }
  } catch {
    // Filter IDs can come from a user-edited URL.
  }
  return undefined;
}

export function getMetadataFilterValue(value: string): string | number | boolean | undefined {
  try {
    const parsed: unknown = JSON.parse(value);
    if (typeof parsed === 'string' || typeof parsed === 'boolean') return parsed;
    if (typeof parsed === 'number' && Number.isFinite(parsed)) return parsed;
  } catch {
    // An unfinished or invalid value must not become a query predicate.
  }
  return undefined;
}
