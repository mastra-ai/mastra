import type { WorkItemBranchSource } from '../work-item-branch.js';

/** What a board filter reads of a card or of an issue not filed yet: where it came from and what that source says of it. */
export interface SourceFacts {
  source: WorkItemBranchSource;
  /** What the source says of the item: its labels, people, Linear project. */
  metadata: Record<string, unknown>;
}

/** The source filters a board view picked. An empty set picks everything. */
export interface SourceFilters {
  source: ReadonlySet<string>;
  linearProject: ReadonlySet<string>;
}

/** Picks every card that has a pull request, whatever it was filed from. */
export const PULL_REQUEST_SOURCE_FILTER = 'pull-request';

const LINEAR_ONLY: ReadonlySet<string> = new Set(['linear']);

/** The source a card is filtered under: its provider, whether it tracks an issue or a pull request. */
export function boardSource(source: WorkItemBranchSource): string {
  if (source === 'incidentio-follow-up') return 'incidentio';
  return source.split('-')[0] ?? source;
}

/** The sources a view keeps; empty keeps all. A Linear project picked alone keeps Linear. */
export function pickedBoardSources(filters: SourceFilters): ReadonlySet<string> {
  if (filters.source.size > 0 || filters.linearProject.size === 0) return filters.source;
  return LINEAR_ONLY;
}

/** Whether the view's source and Linear project filters keep the item. */
export function matchesSourceFilters(item: SourceFacts & { hasPullRequest: boolean }, filters: SourceFilters): boolean {
  const sources = pickedBoardSources(filters);
  if (
    sources.size > 0 &&
    !sources.has(boardSource(item.source)) &&
    !(sources.has(PULL_REQUEST_SOURCE_FILTER) && item.hasPullRequest)
  ) {
    return false;
  }
  if (item.source !== 'linear-issue' || filters.linearProject.size === 0) return true;
  const projectId = item.metadata.linearProjectId;
  return typeof projectId === 'string' && filters.linearProject.has(projectId);
}
