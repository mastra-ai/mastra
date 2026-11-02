type LineIdentity = { sku: string | null; description?: string | null };

export function matchingOrderLine(line: LineIdentity, candidates: LineIdentity[], unused: Set<number>): number {
  const matches = (predicate: (candidate: LineIdentity) => boolean) =>
    candidates.flatMap((candidate, index) => (unused.has(index) && predicate(candidate) ? [index] : []));
  const bySku = line.sku ? matches(candidate => candidate.sku === line.sku) : [];
  if (bySku.length) return bySku.length === 1 ? bySku[0]! : -1;
  // Description fallback can fill in a missing SKU, never override a conflicting one.
  const byDescription = matches(
    candidate =>
      Boolean(line.description) && candidate.description === line.description && (!line.sku || !candidate.sku),
  );
  return byDescription.length === 1 ? byDescription[0]! : -1;
}
