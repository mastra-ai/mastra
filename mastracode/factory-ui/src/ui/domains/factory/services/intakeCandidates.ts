import type { IntakeCandidateListResponse } from '../../../../api/types';
import { requestJson } from './request';

/** The most the route returns in one page. */
const CANDIDATE_PAGE_SIZE = 100;

/**
 * What the server narrows the list to before it pages it, so a page holds only matching records
 * however many newer ones do not match.
 */
export interface IntakeCandidateFilter {
  /** Integrations to list, each alone (`linear`) or with the kind wanted of it (`github:pull-request`). */
  sources?: readonly string[];
  label?: string;
}

/**
 * One page of the open issues and pull requests that have no card yet, newest first.
 * The server keeps this list itself, so reading it calls no provider.
 */
export async function listIntakeCandidates(
  baseUrl: string,
  factoryProjectId: string,
  filter: IntakeCandidateFilter,
  cursor: string | undefined,
  signal: AbortSignal,
): Promise<IntakeCandidateListResponse> {
  const params = new URLSearchParams({ limit: String(CANDIDATE_PAGE_SIZE) });
  for (const source of filter.sources ?? []) params.append('source', source);
  if (filter.label) params.set('label', filter.label);
  if (cursor) params.set('cursor', cursor);
  return requestJson<IntakeCandidateListResponse>(
    `${baseUrl}/web/factory/projects/${encodeURIComponent(factoryProjectId)}/intake/candidates?${params.toString()}`,
    { signal },
  );
}
