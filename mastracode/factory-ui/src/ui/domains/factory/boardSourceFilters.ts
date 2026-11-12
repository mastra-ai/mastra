import type { BoardCandidate } from './boardCandidates';
import { sourceMetadata } from './boardItems';
import type { BoardFilterState } from './boardFilters';
import { cardHasPullRequest } from './services/workItems';
import type { WorkItem, WorkItemSource } from './services/workItems';

/** The source filter value for cards carrying a pull or merge request; where `/review` now leads. */
export const PULL_REQUEST_SOURCE_FILTER = 'pull-request';

export const BOARD_SOURCE_OPTIONS = [
  { value: 'github', label: 'GitHub' },
  { value: 'gitlab', label: 'GitLab' },
  { value: 'linear', label: 'Linear' },
  { value: 'jira', label: 'Jira' },
  { value: 'incidentio', label: 'incident.io' },
  { value: 'manual', label: 'Manual' },
  // Not a provider: any card carrying a pull or merge request, its own or attached to its issue.
  { value: PULL_REQUEST_SOURCE_FILTER, label: 'Pull requests' },
] as const;

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
  card: Pick<WorkItem, 'source' | 'workItem' | 'metadata'>,
  filters: BoardSourceFilters,
  liveCandidate?: BoardCandidate,
): boolean {
  const sources = pickedBoardSources(filters);
  if (
    sources.size > 0 &&
    !sources.has(boardSource(card.source)) &&
    !(sources.has(PULL_REQUEST_SOURCE_FILTER) && cardHasPullRequest(card))
  )
    return false;
  if (card.source !== 'linear-issue' || filters.linearProject.size === 0) return true;
  const projectId = sourceMetadata(liveCandidate ?? card).linearProjectId;
  return typeof projectId === 'string' && filters.linearProject.has(projectId);
}
