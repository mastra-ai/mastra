import type { BoardCandidate } from './boardCandidates';
import type { BoardFilterState } from './boardFilters';
import type { WorkItem, WorkItemSource } from './services/workItems';

export const BOARD_SOURCE_OPTIONS = [
  { value: 'github', label: 'GitHub' },
  { value: 'gitlab', label: 'GitLab' },
  { value: 'linear', label: 'Linear' },
  { value: 'jira', label: 'Jira' },
  { value: 'incidentio', label: 'incident.io' },
  { value: 'manual', label: 'Manual' },
];

type BoardSourceFilters = Pick<BoardFilterState, 'source' | 'linearProject'>;

export function boardSource(source: WorkItemSource): string {
  if (source === 'incidentio-follow-up') return 'incidentio';
  return source.split('-')[0];
}

/** Sources the board shows; empty means all. A Linear project picked on its own implies Linear. */
export function pickedBoardSources(filters: BoardSourceFilters): ReadonlySet<string> {
  if (filters.source.size === 0 && filters.linearProject.size > 0) return new Set(['linear']);
  return filters.source;
}

/** Source and project filters determine which intake feeds to browse. */
export function hasBoardSourceFilters(filters: BoardSourceFilters): boolean {
  return pickedBoardSources(filters).size > 0;
}

/** Live metadata wins, including an issue moved out of a project; stored metadata covers older pages. */
export function cardMatchesSourceFilters(
  card: Pick<WorkItem, 'source' | 'metadata'>,
  filters: BoardSourceFilters,
  liveCandidate?: BoardCandidate,
): boolean {
  const sources = pickedBoardSources(filters);
  if (sources.size > 0 && !sources.has(boardSource(card.source))) return false;
  if (card.source !== 'linear-issue' || filters.linearProject.size === 0) return true;
  const projectId = (liveCandidate ?? card).metadata.linearProjectId;
  return typeof projectId === 'string' && filters.linearProject.has(projectId);
}
