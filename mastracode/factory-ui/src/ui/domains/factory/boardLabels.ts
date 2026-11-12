import type { BoardCandidate } from './boardCandidates';
import { metadataLabels, sourceMetadata } from './boardItems';
import type { WorkItem } from './services/workItems';

export function boardLabels({
  items,
  candidates,
}: {
  items: readonly WorkItem[];
  candidates: readonly BoardCandidate[];
}): string[] {
  const labels = new Set<string>();
  for (const card of [...items, ...candidates])
    for (const label of metadataLabels(sourceMetadata(card))) labels.add(label);
  return [...labels].sort((left, right) => left.localeCompare(right));
}

export function workItemMatchesLabels(item: WorkItem, selectedLabels: ReadonlySet<string>): boolean {
  if (selectedLabels.size === 0) return true;
  const itemLabels = new Set(metadataLabels(sourceMetadata(item)));
  return [...selectedLabels].every(label => itemLabels.has(label));
}

export function candidateMatchesLabels(candidate: BoardCandidate, selectedLabels: ReadonlySet<string>): boolean {
  if (selectedLabels.size === 0) return true;
  const labels = new Set(metadataLabels(candidate.metadata));
  return [...selectedLabels].every(label => labels.has(label));
}
