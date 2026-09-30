/**
 * Shared `@me` predicate.
 *
 * The board filter chip and the Cmd+K search pane both need the same answer:
 * given the acting user's claimed external identities (produced by
 * `IdentityService.resolveMe`), does this record reference any of them?
 *
 * Records come from different integrations, each with its own field names for
 * "author/assignee/requester/mention" style attribution. Callers pass an
 * `AtMeRecord` that names its `integrationId` and populates whichever
 * per-integration fields it knows about; unknown fields stay `undefined`. The
 * predicate reads only the fields that exist on the record — it never
 * fabricates values or asks the caller to normalize into a single shape.
 *
 * The field list mirrors source (a) in Phase 3. If a future ingest change
 * starts persisting a new external-user field on records, add it here and to
 * the observed-authors reader together so the two sides stay in sync.
 */

import type { ResolvedMe } from '../services/identity-service.js';

/**
 * A record the `@me` predicate can evaluate. `integrationId` is required so
 * the predicate can look up the caller's claim set for the right provider;
 * every other field is optional because record shapes vary widely across
 * integrations and per-record (an issue has an assignee, a comment doesn't).
 *
 * All id fields are compared as-is (case-sensitive). Providers keep their own
 * canonical id shape:
 *  - GitHub: `login` (case-insensitive to the provider, but comment-authors
 *    ingest writes the login as returned by the API — matching that same
 *    casing is correct.)
 *  - Linear: `uuid`.
 *  - Jira: `accountId`.
 *  - IncidentIO: user `id`.
 *  - Slack: `user_id`.
 */
export interface AtMeRecord {
  /** The integration the record belongs to; keys into `ResolvedMe`. */
  integrationId: string;
  /** Primary author / creator / reporter, if the record has one. */
  authorExternalUserId?: string | null;
  /** Assignee (single), if the record has one. */
  assigneeExternalUserId?: string | null;
  /** Assignees (many), if the record has many. */
  assigneeExternalUserIds?: readonly string[] | null;
  /** Reporter (Jira-style), if the record has one distinct from author. */
  reporterExternalUserId?: string | null;
  /** Requested reviewers (GitHub), if the record has them. */
  requestedReviewerExternalUserIds?: readonly string[] | null;
  /** People @-mentioned in the record body/comments. */
  mentionedExternalUserIds?: readonly string[] | null;
}

/**
 * True when any external-user field on `record` matches an id the acting user
 * has claimed for `record.integrationId`. Falsy values on the record are
 * skipped; a missing entry in `resolvedMe` for the record's integration means
 * "not me here" and returns false without inspecting the record.
 */
export function matchesMe(record: AtMeRecord, resolvedMe: ResolvedMe): boolean {
  const claimed = resolvedMe.get(record.integrationId);
  if (!claimed || claimed.size === 0) return false;

  if (record.authorExternalUserId && claimed.has(record.authorExternalUserId)) return true;
  if (record.assigneeExternalUserId && claimed.has(record.assigneeExternalUserId)) return true;
  if (record.reporterExternalUserId && claimed.has(record.reporterExternalUserId)) return true;
  if (record.assigneeExternalUserIds && anyClaimed(record.assigneeExternalUserIds, claimed)) return true;
  if (record.requestedReviewerExternalUserIds && anyClaimed(record.requestedReviewerExternalUserIds, claimed))
    return true;
  if (record.mentionedExternalUserIds && anyClaimed(record.mentionedExternalUserIds, claimed)) return true;

  return false;
}

function anyClaimed(ids: readonly string[], claimed: Set<string>): boolean {
  for (const id of ids) {
    if (id && claimed.has(id)) return true;
  }
  return false;
}

/**
 * Convenience predicate that partitions a caller-provided list by the `@me`
 * match. Used by the search-pane expander in Phase 4 that emits an OR of
 * per-provider predicates before dispatching the underlying query.
 */
export function partitionByMe<T extends AtMeRecord>(
  records: readonly T[],
  resolvedMe: ResolvedMe,
): { mine: T[]; others: T[] } {
  const mine: T[] = [];
  const others: T[] = [];
  for (const record of records) {
    if (matchesMe(record, resolvedMe)) mine.push(record);
    else others.push(record);
  }
  return { mine, others };
}
