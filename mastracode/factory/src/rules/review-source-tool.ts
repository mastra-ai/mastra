import type { RequestContext } from '@mastra/core/request-context';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { IntegrationTools } from '../integrations/base.js';
import type { WorkItemRow, WorkItemsStorage } from '../storage/domains/work-items/base.js';
import type { FactorySessionSourceLookup } from './binding-context.js';
import { resolveFactorySessionAddress } from './binding-context.js';

/**
 * Public Linear/Jira issue URL shapes we detect when walking parent work items.
 * The shapes are conservative — matching only what our own integrations record
 * — so a URL parsed out of freeform PR text can never spoof a linked issue.
 */
const LINEAR_ISSUE_URL_RE = /^https:\/\/linear\.app\/[^/]+\/issue\/[^/]+\/[^/?#]+/i;
const JIRA_ISSUE_URL_RE = /^https:\/\/[^/]+\.atlassian\.net\/browse\/[A-Z][A-Z0-9_]+-\d+/i;

export interface ReviewSourceOutput {
  sessionUrl: string;
  triggeredBy: string | null;
  /**
   * The change request this review session is bound to, straight from the
   * work item's `externalSource`. Review skills compare this identity (the
   * canonical URL when present, otherwise provider + external id) against the
   * PR/MR they fetched in Phase 1 so that two requests by the same author can
   * never be conflated. `null` when the bound item records no external source.
   */
  reviewTarget: {
    integrationId: string;
    type: string;
    externalId: string;
    url: string | null;
  } | null;
  linkedIssues: { source: 'linear' | 'jira'; url: string }[];
}

/**
 * `factory_review_source` — read the routing facts behind the current review
 * session (session deep-link, PR author, any linked upstream issue) so the
 * review agent can attribute its verdict to a concrete originating run.
 *
 * The tool exists to make cross-PR misattribution detectable after the fact:
 * a review lands on GitHub with the Factory session URL that produced it, and
 * the human who investigates a suspicious review can jump straight to the run.
 *
 * All fields are derived server-side from the bound work item — nothing enters
 * from the agent's tool arguments — so the session URL always points at the
 * caller's own session, never one it was asked to name.
 */
export async function createReviewSourceTool(options: {
  requestContext: RequestContext;
  storage: Pick<WorkItemsStorage, 'findActiveRunBindingByThread' | 'findActiveRunBinding' | 'get'>;
  sessions?: FactorySessionSourceLookup;
  /**
   * Public origin the Factory web UI is served from, no trailing slash.
   * In a separate-SPA deployment (API host distinct from UI host) this is the
   * UI host — the browser-facing origin the emitted session link opens in.
   * `MastraFactoryConfig.publicUrl` is the API origin and must not be used
   * here; the caller resolves the UI origin (see `factory.ts`) via the
   * `MASTRACODE_PUBLIC_URL` env var, falling back to the API origin only
   * when a single origin serves both.
   */
  uiOrigin: string;
}): Promise<IntegrationTools> {
  const resolution = await resolveFactorySessionAddress({
    requestContext: options.requestContext,
    storage: options.storage,
    sessions: options.sessions,
  });
  if (!resolution) return {};
  const binding = resolution.binding ?? (await options.storage.findActiveRunBinding(resolution.address));
  // The tool exists only for review-role sessions. Work/plan/triage runs never
  // publish reviews on GitHub, so exposing them the tool would just clutter
  // their prompt.
  if (!binding || binding.role !== 'review') return {};

  const item = await options.storage.get({ orgId: binding.orgId, id: binding.workItemId });
  if (!item) return {};

  const sessionUrl = buildSessionUrl({
    uiOrigin: options.uiOrigin,
    factoryProjectId: binding.factoryProjectId,
    sessionId: binding.sessionId,
    threadId: binding.threadId,
  });
  const triggeredBy = readPullRequestAuthor(item);
  const reviewTarget = readReviewTarget(item);

  // The parent walk runs inside `execute` so a `storage.get` failure surfaces
  // on the tool call the agent made, not on tool registration (which would
  // silently drop the whole tool from this session and every other tool
  // registered in the same batch). The pre-fetched `item` and `binding` are
  // safe to close over — they were resolved above from data the request
  // context guarantees is present for a review-role session.
  const storage = options.storage;

  return {
    factory_review_source: createTool({
      id: 'factory_review_source',
      description:
        'Read the routing facts behind this review session: a deep-link back to the Factory session that produced the review, the author of the change request under review (when known), the bound change-request identity (provider, external id, canonical URL), and any Linear or Jira issue linked as the source of this work. Compare the bound identity against the PR/MR you are reviewing, and include the session URL in every review comment or verdict you publish so misattributed reviews can be traced back to their originating session.',
      inputSchema: z.object({}),
      execute: async (): Promise<ReviewSourceOutput> => {
        const linkedIssues = await collectLinkedIssues(item, storage);
        return { sessionUrl, triggeredBy, reviewTarget, linkedIssues };
      },
    }),
  };
}

function buildSessionUrl(input: {
  uiOrigin: string;
  factoryProjectId: string;
  sessionId: string;
  threadId: string;
}): string {
  const origin = input.uiOrigin.replace(/\/+$/, '');
  return `${origin}/factories/${encodeURIComponent(input.factoryProjectId)}/workspaces/${encodeURIComponent(input.sessionId)}/threads/${encodeURIComponent(input.threadId)}`;
}

function readReviewTarget(item: WorkItemRow): ReviewSourceOutput['reviewTarget'] {
  const source = item.externalSource;
  if (!source) return null;
  return {
    integrationId: source.integrationId,
    type: source.type,
    externalId: source.externalId,
    url: typeof source.url === 'string' && source.url ? source.url : null,
  };
}

function readPullRequestAuthor(item: WorkItemRow): string | null {
  const metadata = item.metadata;
  if (!metadata) return null;
  const author = metadata.author;
  if (typeof author === 'string' && author.trim()) return author.trim();
  return null;
}

/**
 * Walk from the review card up its parent chain, collecting the URL of any
 * work item sourced from Linear or Jira. The chain is bounded (a review card
 * points at its authoring work item, which may point at a triage/parent) and
 * capped defensively so a malformed cycle can never spin the loop.
 *
 * A `storage.get` failure while resolving a parent is **not** swallowed:
 * returning an empty or partial `linkedIssues` list on a lookup error would
 * make the published review say "no linked issue" for a review that simply
 * couldn't be resolved. Instead, the error propagates to `execute` and the
 * tool call fails — the skill's failure branch stops publication rather than
 * publishing a review body missing provenance the tool could have surfaced.
 * Normal termination (no more parents, or a parent we've already seen) still
 * returns the results collected so far.
 */
async function collectLinkedIssues(
  reviewItem: WorkItemRow,
  storage: Pick<WorkItemsStorage, 'get'>,
): Promise<ReviewSourceOutput['linkedIssues']> {
  const results: ReviewSourceOutput['linkedIssues'] = [];
  const seen = new Set<string>([reviewItem.id]);
  let cursor: WorkItemRow | null = reviewItem;
  let hops = 0;
  const MAX_HOPS = 4;

  while (cursor && hops < MAX_HOPS) {
    const source = cursor.externalSource;
    if (source?.integrationId === 'linear' && typeof source.url === 'string' && LINEAR_ISSUE_URL_RE.test(source.url)) {
      results.push({ source: 'linear', url: source.url });
    } else if (
      source?.integrationId === 'jira' &&
      typeof source.url === 'string' &&
      JIRA_ISSUE_URL_RE.test(source.url)
    ) {
      results.push({ source: 'jira', url: source.url });
    }
    const parentId = cursor.parentWorkItemId;
    if (!parentId || seen.has(parentId)) break;
    seen.add(parentId);
    // No try/catch here: a storage error surfaces to the tool caller so the
    // skill's failure branch can stop publication rather than silently
    // dropping linked-issue provenance the review body should have carried.
    cursor = await storage.get({ orgId: cursor.orgId, id: parentId });
    hops += 1;
  }
  return results;
}
