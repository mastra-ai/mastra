import { metadataLabels } from '@mastra/factory/work-items/card-labels';

import type { BoardCandidate } from './boardCandidates';

/** The labels the label filter offers: the ones the project's cards carry, and the ones of issues not filed yet. */
export function boardLabels({
  labels: filed,
  candidates,
}: {
  /** The labels of the project's cards, as the server lists them. */
  labels: readonly string[];
  candidates: readonly BoardCandidate[];
}): string[] {
  const labels = new Set(filed);
  for (const candidate of candidates) for (const label of metadataLabels(candidate.metadata)) labels.add(label);
  return [...labels].sort((left, right) => left.localeCompare(right));
}
