/**
 * A status reaction on the first message of a Slack thread, so the people in
 * it can see where their request stands without opening Factory.
 */

import type { AgentControllerRequestContext } from '@mastra/core/agent-controller';
import type { AgentChannels } from '@mastra/core/channels';
import type { Processor, ProcessOutputResultArgs } from '@mastra/core/processors';
import type { RequestContext } from '@mastra/core/request-context';
import type { Adapter } from 'chat';

import { factoryUserOrgId, getFactoryAuthOrgId, getFactoryAuthUserFromContext } from '../../auth.js';
import { findSessionRunBinding } from '../../rules/binding-context.js';
import type { IntegrationStorageHandle } from '../../storage/domains/integrations/base.js';
import type { WorkItemsStorage } from '../../storage/domains/work-items/base.js';
import { REPLY_TOOL_NAME } from './reply-tool.js';
import { resolveRenderContext } from './share-file-tool.js';
import type { ShareFileToolDeps } from './share-file-tool.js';

export const DONE_REACTION = 'white_check_mark';

/** The reaction for each card stage. Stages not listed show no reaction. */
export const STAGE_REACTIONS: Record<string, string> = {
  triage: 'eyes',
  planning: 'memo',
  execute: 'hammer',
  review: 'mag',
  done: DONE_REACTION,
};

/**
 * Replace `remove` with `add` on the thread's first message. Slack thread ids
 * are `slack:<channel>:<thread ts>`, and the thread ts is that message's ts.
 * Best-effort: a failure is logged and never reaches the caller, and a failed
 * removal (the reaction was never there) still lets the new one through.
 */
export async function swapThreadReaction(
  adapter: Pick<Adapter, 'addReaction' | 'removeReaction'>,
  threadId: string,
  { remove, add }: { remove?: string; add?: string },
): Promise<void> {
  const [platform, channel, rootTs] = threadId.split(':');
  if (platform !== 'slack' || !channel || !rootTs || remove === add) return;
  const attempt = (call: Promise<void>, emoji: string) =>
    call.catch(error => console.warn('[slack] thread status reaction failed', { threadId, emoji, error }));
  if (remove) await attempt(adapter.removeReaction(threadId, rootTs, remove), remove);
  if (add) await attempt(adapter.addReaction(threadId, rootTs, add), add);
}

/**
 * Post a pull request's link into the Slack thread a session is linked to.
 * A merge also closes the thread out with ✅.
 */
export async function announcePullRequest(
  channels: AgentChannels | null | undefined,
  threadId: string,
  milestone: 'opened' | 'merged',
  url: string,
): Promise<void> {
  const render = await channels?.buildRenderContextForThread(threadId);
  if (render?.platform !== 'slack') return;
  await render.chatThread.post({ markdown: `Pull request ${milestone}: ${url}` });
  if (milestone === 'merged') await swapThreadReaction(render.adapter, render.chatThread.id, { add: DONE_REACTION });
}

type SessionMarkers = Pick<IntegrationStorageHandle['subscriptions'], 'create' | 'listBySession'>;

/** Marks a session as having opened a pull request, so its replies no longer close the thread. */
const OPENED_PULL_REQUEST = 'opened-pull-request';

function sessionOf(requestContext: RequestContext) {
  return (requestContext.get('controller') as AgentControllerRequestContext | undefined)?.sessionId;
}

export async function rememberOpenedPullRequest(
  markers: SessionMarkers,
  requestContext: RequestContext,
  url: string,
): Promise<void> {
  const sessionId = sessionOf(requestContext);
  const user = getFactoryAuthUserFromContext(requestContext);
  const orgId = getFactoryAuthOrgId(user) ?? factoryUserOrgId(user);
  if (!sessionId || !orgId) return;
  await markers.create({ orgId, targetKey: `${OPENED_PULL_REQUEST}:${url}`, sessionId, status: OPENED_PULL_REQUEST });
}

export interface ThreadDoneDeps extends ShareFileToolDeps {
  workItems?: () => Pick<WorkItemsStorage, 'findActiveRunBindingByThread'> | undefined;
  markers?: () => SessionMarkers | undefined;
}

/**
 * Adds ✅ to a Slack thread once a run that replied in it ends, so the people
 * there can see their question was answered. ✅ means closed out, so it is not
 * added when the run never posted, when the session opened a pull request (its
 * merge closes the thread out instead), or when the run works on a card (the
 * card's stage shows instead).
 */
export class FactoryThreadDoneProcessor implements Processor {
  readonly id = 'factory-thread-done';

  constructor(private readonly deps: ThreadDoneDeps) {}

  processOutputResult({ messages, result, requestContext }: ProcessOutputResultArgs) {
    const replied = result.steps.some(step =>
      step.toolResults.some(chunk => chunk.payload.toolName === REPLY_TOOL_NAME && !chunk.payload.isError),
    );
    if (replied && requestContext) {
      // Not awaited: the run is finished and must not wait on Slack.
      void this.#markDone(requestContext).catch(error => console.warn('[slack] thread done reaction failed', error));
    }
    return messages;
  }

  async #markDone(requestContext: NonNullable<ProcessOutputResultArgs['requestContext']>): Promise<void> {
    const workItems = this.deps.workItems?.();
    const markers = this.deps.markers?.();
    const sessionId = sessionOf(requestContext);
    if (!workItems || !markers || !sessionId) return;
    if (await findSessionRunBinding(requestContext, workItems)) return;
    const sessionMarkers = await markers.listBySession(sessionId);
    if (sessionMarkers.some(marker => marker.status === OPENED_PULL_REQUEST)) return;
    const render = await resolveRenderContext(requestContext, this.deps);
    if (render?.platform !== 'slack') return;
    await swapThreadReaction(render.adapter, render.chatThread.id, { add: DONE_REACTION });
  }
}
