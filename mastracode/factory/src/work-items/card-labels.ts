/** The labels a source put on an item. */
export function metadataLabels(metadata: Record<string, unknown>): string[] {
  return Array.isArray(metadata.labels)
    ? metadata.labels.filter((label): label is string => typeof label === 'string')
    : [];
}

/** Whether the item carries every picked label. */
export function hasEveryLabel(labels: ReadonlySet<string>, picked: Iterable<string>): boolean {
  for (const label of picked) {
    if (!labels.has(label)) return false;
  }
  return true;
}
