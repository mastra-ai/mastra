import {
  SESSION_ROW_ALL_SOURCES,
  SESSION_ROW_PINS_MAX,
  SESSION_ROW_WINDOW_MAX,
  SESSION_ROW_WINDOWS_MAX,
} from '@mastra/factory/session/session-row-query';

import type { SessionActivity, SessionRowsRequest, SessionRowsResponse } from '../../../../api/types';
import { requestJson } from '../../factory/services/request';
import type { SessionFiltersState } from './sessionFilters';
import type { SessionGroupBy } from './sessionGroups';
import type { SessionSort } from './sessionSort';

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
    ...(filters.source === SESSION_ROW_ALL_SOURCES ? {} : { source: filters.source }),
    children,
    pin: [...pinned].slice(-SESSION_ROW_PINS_MAX).sort(),
    ...(open ? { open } : {}),
    windows: Object.fromEntries(
      Object.entries(windows)
        .slice(-SESSION_ROW_WINDOWS_MAX)
        .map(([group, count]) => [group, Math.min(count, SESSION_ROW_WINDOW_MAX)]),
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
  if (request.source) params.set('source', request.source);
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
