import type { BoardCandidate } from './boardCandidates';
import type { BoardFilterState } from './boardFilters';
import type { WorkItem, WorkItemSource } from './services/workItems';

export const BOARD_SOURCE_OPTIONS = [
  { value: 'github', label: 'GitHub' },
  { value: 'gitlab', label: 'GitLab' },
  { value: 'linear', label: 'Linear' },
  { value: 'jira', label: 'Jira' },
  { value: 'incidentio', label: 'incident.io' },
  { value: 'slack', label: 'Slack' },
  { value: 'manual', label: 'Manual' },
];

export function boardSource(source: WorkItemSource): string {
  if (source === 'incidentio-follow-up') return 'incidentio';
  return source.split('-')[0];
}

/** Live metadata wins, including an issue moved out of a project; stored metadata covers older pages. */
export function cardMatchesSourceFilters(
  card: Pick<WorkItem, 'source' | 'metadata'>,
  filters: Pick<BoardFilterState, 'sources' | 'linearProjectIds'>,
  liveCandidate?: BoardCandidate,
): boolean {
  if (filters.sources.size > 0 && !filters.sources.has(boardSource(card.source))) return false;
  if (filters.linearProjectIds.size === 0) return true;
  if (card.source !== 'linear-issue') return false;
  const projectId = (liveCandidate ?? card).metadata.linearProjectId;
  return typeof projectId === 'string' && filters.linearProjectIds.has(projectId);
}
