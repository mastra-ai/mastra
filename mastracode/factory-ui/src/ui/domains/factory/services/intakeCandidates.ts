import type { IntakeCandidateListResponse } from '../../../../api/types';
import { requestJson } from './request';

/** The most the route returns in one page. */
const CANDIDATE_PAGE_SIZE = 100;

/**
 * One page of the open issues and pull requests that have no card yet, newest first.
 * The server keeps this list itself, so reading it calls no provider.
 */
export async function listIntakeCandidates(
  baseUrl: string,
  factoryProjectId: string,
  cursor: string | undefined,
  signal: AbortSignal,
): Promise<IntakeCandidateListResponse> {
  const params = new URLSearchParams({ limit: String(CANDIDATE_PAGE_SIZE) });
  if (cursor) params.set('cursor', cursor);
  return requestJson<IntakeCandidateListResponse>(
    `${baseUrl}/web/factory/projects/${encodeURIComponent(factoryProjectId)}/intake/candidates?${params.toString()}`,
    { signal },
  );
}
