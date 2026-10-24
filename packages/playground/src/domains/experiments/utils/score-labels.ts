/** How many scores carry each categorical label, e.g. `{ failing: 1, exemplary: 5 }`. */
export type LabelCounts = Record<string, number>;

/**
 * Counts the categorical labels of a run's scores, per scorer. Scorers whose scores
 * carry no label are left out, so numeric-only runs yield `{}`.
 */
export function countScoreLabels(
  scores: Iterable<{ scorerId: string; label?: string | null }>,
): Record<string, LabelCounts> {
  const counts: Record<string, LabelCounts> = {};
  for (const { scorerId, label } of scores) {
    if (!label) continue;
    counts[scorerId] ??= {};
    counts[scorerId][label] = (counts[scorerId][label] ?? 0) + 1;
  }
  return counts;
}

/** Label counts as entries, most frequent first, ties by label name. */
export function sortLabelCounts(counts: LabelCounts): Array<[label: string, count: number]> {
  return Object.entries(counts).sort(([aLabel, aCount], [bLabel, bCount]) =>
    bCount !== aCount ? bCount - aCount : aLabel.localeCompare(bLabel),
  );
}
