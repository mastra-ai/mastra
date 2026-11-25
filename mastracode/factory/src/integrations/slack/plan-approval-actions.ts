import type { ActionChannelHandler, ChannelConfig } from '@mastra/core/channels';
import type { ActionEvent } from 'chat';

import { followsCard } from '../../session/parked-approval-access.js';
import type { AuditRecorder } from '../../storage/domains/audit/domain.js';
import type { ChannelIdentityStorage } from '../../storage/domains/channel-identity/base.js';
import type { SourceControlSession } from '../../storage/domains/source-control/base.js';
import type { WorkItemsStorage } from '../../storage/domains/work-items/base.js';
import { answerParkedCall, ParkedCallStillWaitingError } from '../../tools/approval-tools.js';
import type { FactoryApprovalToolDependencies } from '../../tools/approval-tools.js';
import { parsePlanApproveActionId, planResolvedCard } from './plan-approval-card.js';
import type { PlanCardResolution } from './plan-approval-card.js';
import type { PlanApprovalCards } from './plan-approval-post.js';
import { rawTeamId } from './slack.js';

export interface PlanApproveActionDependencies {
  accountLinks?: Pick<ChannelIdentityStorage, 'getAccountLink'>;
  getSession: (sessionId: string) => Promise<SourceControlSession | null>;
  workItems?: Partial<Pick<WorkItemsStorage, 'get' | 'listWorkItemSubscribers' | 'findActiveRunBindingForSession'>>;
  messaging: FactoryApprovalToolDependencies['messaging'];
  audit?: AuditRecorder;
  cards: PlanApprovalCards;
}

export const PLAN_APPROVE_UNLINKED = 'Link your Slack account to Factory to approve this plan.';
export const PLAN_APPROVE_FORBIDDEN =
  "Only the session's owner, the person who filed its card, or someone following the card can approve this plan from Slack.";

/**
 * Handles a click on a plan card's Approve button: answers the parked
 * `submit_plan` call as the linked Factory person, if they may, and settles
 * the cards. Returns false for any other action.
 */
export async function handlePlanApproveAction(
  deps: PlanApproveActionDependencies,
  event: Pick<ActionEvent, 'actionId' | 'adapter' | 'messageId' | 'raw' | 'thread' | 'threadId' | 'user'>,
): Promise<boolean> {
  const ids = parsePlanApproveActionId(event.actionId);
  if (!ids) return false;
  const { sessionId, toolCallId } = ids;
  const tell = async (text: string) => {
    try {
      await event.thread?.postEphemeral(event.user, text, { fallbackToDM: false });
    } catch (error) {
      console.warn('[Factory Slack] Unable to answer a plan approval click.', error);
    }
  };
  const settle = async (resolution: PlanCardResolution) => {
    const card = deps.cards.posted(toolCallId);
    try {
      await event.adapter.editMessage(
        event.threadId,
        event.messageId,
        planResolvedCard(
          card?.plan ?? { ok: false, path: '', reason: '' },
          card?.target ?? { sessionId, toolCallId, subject: '' },
          resolution,
        ),
      );
    } catch (error) {
      console.warn('[Factory Slack] Unable to settle a plan approval card.', error);
    }
  };

  const externalTeamId = rawTeamId(event.raw);
  const link =
    deps.accountLinks && externalTeamId
      ? await deps.accountLinks.getAccountLink({
          platform: event.adapter.name,
          externalTeamId,
          externalUserId: event.user.userId,
        })
      : null;
  if (!link) {
    await tell(PLAN_APPROVE_UNLINKED);
    return true;
  }
  const session = await deps.getSession(sessionId);
  if (!session || (link.orgId && link.orgId !== session.orgId)) {
    await tell(PLAN_APPROVE_FORBIDDEN);
    return true;
  }
  const isOwner = session.userId === link.userId;
  const binding =
    session.factoryProjectId && deps.workItems?.findActiveRunBindingForSession
      ? await deps.workItems.findActiveRunBindingForSession({
          orgId: session.orgId,
          factoryProjectId: session.factoryProjectId,
          sessionId: session.sessionId,
        })
      : null;
  const allowed =
    isOwner ||
    (session.visibility !== 'private' &&
      (await followsCard(
        { ...(deps.workItems ? { workItems: deps.workItems } : {}), getSession: deps.getSession },
        binding?.workItemId,
        { orgId: session.orgId, userId: link.userId },
      )));
  if (!allowed) {
    await tell(PLAN_APPROVE_FORBIDDEN);
    return true;
  }

  const by = `<@${event.user.userId}>`;
  const forget = deps.cards.approving(toolCallId, by);
  let toolName: string;
  try {
    ({ toolName } = await answerParkedCall(
      { messaging: deps.messaging },
      { session, toolCallId, decision: 'approve', declineReason: '' },
    ));
  } catch (error) {
    forget();
    // A call that still waits keeps its cards, so the plan can be approved again.
    if (!(error instanceof ParkedCallStillWaitingError)) {
      await settle({ kind: 'stale' });
      await deps.cards.resolve(toolCallId, { kind: 'stale' }, event.threadId);
    }
    await tell(error instanceof Error ? error.message : String(error));
    return true;
  }
  await settle({ kind: 'approved', by });
  await deps.cards.resolve(toolCallId, { kind: 'approved', by }, event.threadId);
  await deps.audit?.record({
    orgId: session.orgId,
    actorId: link.userId,
    actorType: 'human',
    action: 'factory.run.approved',
    ...(session.factoryProjectId ? { factoryProjectId: session.factoryProjectId } : {}),
    targets: [
      { type: 'session', id: session.sessionId },
      ...(binding ? [{ type: 'work_item' as const, id: binding.workItemId }] : []),
    ],
    metadata: { toolCallId, toolName, sessionId: session.sessionId, decision: 'approve', cause: 'slack' },
  });
  return true;
}

/** The channels config with plan Approve clicks handled ahead of its own action handler. */
export function withPlanApproveActions(config: ChannelConfig, deps: PlanApproveActionDependencies): ChannelConfig {
  const own = config.handlers?.onAction;
  if (own === false) return config;
  const onAction: ActionChannelHandler = async (event, defaultHandler, ctx) => {
    if (await handlePlanApproveAction(deps, event)) return;
    return typeof own === 'function' ? own(event, defaultHandler, ctx) : defaultHandler();
  };
  return { ...config, handlers: { ...config.handlers, onAction } };
}
