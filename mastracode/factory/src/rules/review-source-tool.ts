import type { RequestContext } from '@mastra/core/request-context';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { IntegrationTools } from '../integrations/base.js';
import type { WorkItemRow, WorkItemsStorage } from '../storage/domains/work-items/base.js';
import type { FactorySessionSourceLookup } from './binding-context.js';
import { resolveFactorySessionAddress } from './binding-context.js';

export interface ReviewSourceOutput {
  /**
   * Browser-facing deep-link back to the Factory session that produced this
   * review — the only field a review body publishes. Everything else on this
   * shape is an input to in-run cross-checks and the session handoff, never a
   * published field, so the GitHub/GitLab audience never sees the upstream
   * Linear/Jira slug through the review comment.
   */
  sessionUrl: string;
  /**
   * PR/MR author recorded on the review card at intake — for GitHub this is
   * `pullRequest.user.login`, for GitLab it is the GitLab username. The skill
   * cross-checks it against `gh pr view --json author` (`.author.login`) or
   * the equivalent MR fetch; a mismatch means the session is bound to a
   * different PR/MR than the one being reviewed.
   */
  triggeredBy: string | null;
  /**
   * The externalSource recorded on the review card itself — the PR/MR the
   * session was intake-bound to. The skill cross-checks the reviewed PR/MR
   * against this shape so a review can never quietly land on the wrong target.
   */
  reviewTarget: {
    integrationId: string;
    type: string;
    externalId: string;
    url: string | null;
  } | null;
}

/**
 * `factory_review_source` — read the routing facts behind the current review
 * session (session deep-link, PR/MR author, the review target) so the review
 * agent can attribute its verdict to a concrete originating run and detect a
 * mis-targeted review before it publishes.
 *
 * The tool exists to make cross-PR misattribution detectable both in-run and
 * after the fact: a review lands on GitHub/GitLab with the Factory session URL
 * that produced it, and the human who investigates a suspicious review can
 * jump straight to the run.
 *
 * All fields are derived server-side from the bound work item — nothing enters
 * from the agent's tool arguments — so the session URL always points at the
 * caller's own session, never one it was asked to name.
 *
 * The tool is intentionally omitted (returns `{}`) whenever it cannot produce
 * a complete, correct provenance shape: no resolvable session address, no
 * active binding, a non-review-role binding, no bound work item, or no
 * configured browser-facing UI origin. Skills treat tool-absent identically to
 * tool-failed: stop-don't-publish.
 */
export async function createReviewSourceTool(options: {
  requestContext: RequestContext;
  storage: Pick<WorkItemsStorage, 'findActiveRunBindingByThread' | 'findActiveRunBinding' | 'get'>;
  sessions?: FactorySessionSourceLookup;
  /**
   * Browser-facing UI origin, no trailing slash. In a separate-SPA deployment
   * (API host distinct from UI host) this is the UI host — the origin the
   * emitted session link opens in. `MastraFactoryConfig.publicUrl` is the API
   * origin and must not be used here; the caller resolves the UI origin (see
   * `factory.ts`) via the `MASTRACODE_PUBLIC_URL` env var.
   *
   * `null` means no browser-facing origin is configured. Match the Slack
   * session-link surface (`integrations/slack/slack.ts:168-171`, `:809-812`),
   * which omits the deep-link entirely rather than publishing an API/localhost
   * URL into a public body: the tool is dropped from the toolset, and the
   * skill's tool-not-available branch stops publication.
   */
  uiOrigin: string | null;
}): Promise<IntegrationTools> {
  if (options.uiOrigin === null) return {};
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
  // Every field is pre-resolved server-side and returned as a plain object.
  // The tool takes no arguments and does no further I/O, so a review-role
  // session either sees a complete provenance shape or the tool is absent —
  // the skill treats those branches identically (stop-don't-publish).
  const output: ReviewSourceOutput = { sessionUrl, triggeredBy, reviewTarget };

  return {
    factory_review_source: createTool({
      id: 'factory_review_source',
      description:
        'Read the routing facts behind this review session: a deep-link back to the Factory session that produced the review, the PR/MR author recorded on the review card, and the review target (the PR/MR the session was intake-bound to). Publish the session URL in the required `Factory Session` block of every review body so a misattributed review can always be traced back to the run that produced it. Cross-check `triggeredBy` and `reviewTarget` against the PR/MR you fetched in Phase 1; do not publish the `triggeredBy` or `reviewTarget` fields.',
      inputSchema: z.object({}),
      execute: async (): Promise<ReviewSourceOutput> => output,
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
