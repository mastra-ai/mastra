/**
 * Filter a raw `extractedValues` map down to slugs registered for custom extractors.
 * Built-in slugs are stored on dedicated thread-metadata fields and should not be
 * duplicated into the generic extracted-values map.
 */
export function filterExtractedValuesForStorage(
  values: Record<string, unknown> | undefined,
  additionalExtractors: ReadonlyArray<{ slug: string }>,
): Record<string, unknown> | undefined {
  if (!values || additionalExtractors.length === 0) return undefined;
  const result: Record<string, unknown> = {};
  for (const extractor of additionalExtractors) {
    const value = values[extractor.slug];
    if (value !== undefined && value !== '') {
      result[extractor.slug] = value;
    }
  }
  return Object.keys(result).length > 0 ? result : undefined;
}
