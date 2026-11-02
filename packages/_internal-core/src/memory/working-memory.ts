/** Merge working memory patches: null deletes keys, arrays replace. */
export function deepMergeWorkingMemory(
  existing: Record<string, unknown> | null | undefined,
  update: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  // Handle null/undefined/empty updates - preserve existing or return empty object
  if (!update || typeof update !== 'object' || Object.keys(update).length === 0) {
    return existing && typeof existing === 'object' ? { ...existing } : {};
  }

  const base = existing && typeof existing === 'object' && !Array.isArray(existing) ? existing : {};
  const result: Record<string, unknown> = { ...base };

  for (const key of Object.keys(update)) {
    const updateValue = update[key];
    const existingValue = result[key];

    // undefined means the field was omitted - leave existing value untouched
    if (updateValue === undefined) {
      continue;
    }

    // null means delete the property
    if (updateValue === null) {
      delete result[key];
    }
    // Arrays are replaced entirely (too complex to diff/merge arrays of objects)
    else if (Array.isArray(updateValue)) {
      result[key] = updateValue;
    }
    // Recursively merge nested objects. Brand-new branches recurse too, so nulls inside
    // them are dropped instead of being stored literally.
    else if (typeof updateValue === 'object') {
      const existingBranch =
        existingValue && typeof existingValue === 'object' && !Array.isArray(existingValue)
          ? (existingValue as Record<string, unknown>)
          : undefined;

      result[key] = deepMergeWorkingMemory(existingBranch, updateValue as Record<string, unknown>);
    }
    // Primitive values or new properties: just set them
    else {
      result[key] = updateValue;
    }
  }

  return result;
}
