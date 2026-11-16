import type { SessionActivity, SessionRowsRequest, SessionRowsResponse } from '../../../../api/types';
import { requestJson } from '../../factory/services/request';
import type { SessionFiltersState } from './sessionFilters';
import type { SessionGroupBy } from './sessionGroups';
import type { SessionSort } from './sessionSort';

/** The most pinned sessions the server accepts. */
const PINNED_SESSIONS_ASKED = 100;
/** The deepest window the server accepts. */
const DEEPEST_GROUP_WINDOW = 500;

// The sidebar and the route loader both build it here, so the loader's read is the one the sidebar waits for.
export function sessionRowsRequest({
  sort,
  groupBy,
  filters,
  pinned,
  open,
  children,
  windows,
}: {
  sort: SessionSort;
  groupBy: SessionGroupBy;
  filters: SessionFiltersState;
  /** In the order they were pinned: the latest ones are asked when there are more than the server accepts. */
  pinned: ReadonlySet<string>;
  open: string | undefined;
  children: boolean;
  windows: Readonly<Record<string, number>>;
}): SessionRowsRequest {
  return {
    sort,
    groupBy,
    owner: filters.owner,
    ...(filters.status === 'all' ? {} : { status: filters.status }),
    ...(filters.updated === 'all' ? {} : { updated: filters.updated }),
    children,
    pin: [...pinned].slice(-PINNED_SESSIONS_ASKED).sort(),
    ...(open ? { open } : {}),
    windows: Object.fromEntries(
      Object.entries(windows).map(([group, count]) => [group, Math.min(count, DEEPEST_GROUP_WINDOW)]),
    ),
  };
}

export function fetchSessionRows(
  baseUrl: string,
  factoryProjectId: string,
  request: SessionRowsRequest,
  signal?: AbortSignal,
): Promise<SessionRowsResponse> {
  // One order of parameters per view: the browser revalidates an address it has already read.
  const params = new URLSearchParams({ sort: request.sort, groupBy: request.groupBy, owner: request.owner });
  if (request.status) params.set('status', request.status);
  if (request.updated) params.set('updated', request.updated);
  if (request.children) params.set('children', 'true');
  for (const id of request.pin) params.append('pin', id);
  if (request.open) params.set('open', request.open);
  for (const [group, count] of Object.entries(request.windows).sort(([left], [right]) => left.localeCompare(right))) {
    params.append('window', `${group}:${count}`);
  }
  return requestJson<SessionRowsResponse>(
    `${baseUrl}/web/factory/projects/${encodeURIComponent(factoryProjectId)}/session-rows?${params}`,
    { signal },
  );
}

export function fetchSessionActivity(
  baseUrl: string,
  factoryProjectId: string,
  signal?: AbortSignal,
): Promise<SessionActivity> {
  return requestJson<SessionActivity>(
    `${baseUrl}/web/factory/projects/${encodeURIComponent(factoryProjectId)}/session-activity`,
    { signal },
  );
}
