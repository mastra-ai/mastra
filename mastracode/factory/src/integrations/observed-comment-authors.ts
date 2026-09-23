/**
 * Shared source-(a) "observed" reader for `IntegrationIdentityCapability`.
 *
 * Every integration's observed candidate accounts are the distinct external
 * comment authors carried on `work_item_comments.author_external.platform`
 * matching the integration's platform slug. The comments domain does the
 * scan; this helper wraps it with the query-substring filter the capability
 * routes accept.
 *
 * The plan originally described per-integration observed queries against
 * assignee/reviewer/reporter columns that do not exist in factory storage —
 * comments are the one persisted per-org, per-integration external-user
 * signal. See `.mastracode/plans/integration-identity-links.amendments.md`.
 */

import type { WorkItemCommentsStorage } from '../storage/domains/comments/base.js';
import type { IntegrationCandidateAccount, IntegrationIdentityCapability } from './base.js';

export interface ObservedCommentAuthorsArgs {
  orgId: string;
  /**
   * Value the ingest pipeline wrote to `author_external.platform` for records
   * this integration produces. `'github'`, `'linear'`, `'jira'`,
   * `'incidentio'`, `'slack'`.
   */
  platform: string;
  query?: string;
  /** Cap on rows scanned; default 2_000 mirrors the comments handle default. */
  limit?: number;
}

/**
 * Case-insensitive substring match against `label` or `externalUserId`.
 * Email is not currently written to `author_external` by any integration; the
 * filter still consults an `email` field so future ingest changes light up
 * transparently.
 */
function matchesQuery(candidate: IntegrationCandidateAccount, needle: string): boolean {
  const lower = needle.toLowerCase();
  if (candidate.label.toLowerCase().includes(lower)) return true;
  if (candidate.externalUserId.toLowerCase().includes(lower)) return true;
  if (candidate.email && candidate.email.toLowerCase().includes(lower)) return true;
  return false;
}

export async function listObservedCommentAuthors(
  comments: Pick<WorkItemCommentsStorage, 'listExternalAuthorsForOrg'>,
  args: ObservedCommentAuthorsArgs,
): Promise<IntegrationCandidateAccount[]> {
  const rows = await comments.listExternalAuthorsForOrg({
    orgId: args.orgId,
    platform: args.platform,
    ...(args.limit !== undefined ? { limit: args.limit } : {}),
  });
  const candidates: IntegrationCandidateAccount[] = rows.map(row => ({
    externalUserId: row.externalUserId,
    label: row.label,
    ...(row.email ? { email: row.email } : {}),
  }));
  const trimmedQuery = args.query?.trim();
  if (!trimmedQuery) return candidates;
  return candidates.filter(candidate => matchesQuery(candidate, trimmedQuery));
}

/**
 * Common capability object: every integration whose observed candidates
 * come from `work_item_comments.author_external` mounts this and specifies
 * which platform slug identifies its rows. Integrations that later grow a
 * source-(b) roster wrap this builder's return with a merge — see
 * `mergeCandidates`.
 */
export function buildCommentAuthorsIdentity(platform: string): IntegrationIdentityCapability {
  return {
    async listCandidateAccounts(ctx, args) {
      return listObservedCommentAuthors(ctx.storage.comments, {
        orgId: args.orgId,
        platform,
        ...(args.query !== undefined ? { query: args.query } : {}),
      });
    },
  };
}


