import type { AgentControllerEvent } from '@mastra/core/agent-controller';
import type { AgentChannels } from '@mastra/core/channels';
import type { NotificationsStorage } from '@mastra/core/notifications';
import type { SentMessage } from 'chat';

import type { SourceControlSessionLookup } from '../../session/factory-session.js';
import { FACTORY_SESSION_NOTIFICATION_SOURCE } from '../../tools/deliver.js';
import type { PlanDigestResult } from '../../tools/plan-digest.js';
import type { FactoryPlanApprovalRequest } from '../../tools/reports.js';
import type { RunReportSession } from '../../tools/run-watch.js';
import { SUBMIT_PLAN_TOOL_NAME } from '../../tools/run-watch.js';
import { sessionLink } from './channel-reply-processor.js';
import { planApprovalCard, planApprovalText, planResolvedCard } from './plan-approval-card.js';
import type { PlanCardResolution, PlanCardTarget } from './plan-approval-card.js';

/** How many recent reports on a thread the restart-safe check reads for an earlier card. */
const POSTED_SCAN = 100;

interface PostedPlanCard {
  message: Pick<SentMessage, 'edit'>;
  plan: PlanDigestResult;
  target: PlanCardTarget;
}

export interface PlanApprovalCardsDependencies {
  channels: () => AgentChannels | null | undefined;
  sessions: Pick<SourceControlSessionLookup, 'getBySessionId'>;
  /** Where earlier reports are kept, so a card posted before a restart is not posted again. */
  notifications?: () => Promise<Pick<NotificationsStorage, 'listNotifications'> | null>;
}

/**
 * The Slack approval cards for plans sessions are waiting on: one per parked
 * `submit_plan` call in each follower thread on Slack. Remembers what it posted
 * in this process, so a card can be settled when its call is answered.
 */
export class PlanApprovalCards {
  readonly #deps: PlanApprovalCardsDependencies;
  /** toolCallId → threadId → the card in that thread. */
  readonly #posted = new Map<string, Map<string, PostedPlanCard>>();
  /** `toolCallId:threadId` pairs being posted right now. */
  readonly #posting = new Set<string>();
  /** Who is approving a call from a card right now, so every card can name them. */
  readonly #approvers = new Map<string, string>();

  constructor(deps: PlanApprovalCardsDependencies) {
    this.#deps = deps;
  }

  /** Posts the card in each recipient thread on Slack; returns the threads that got one. Never throws. */
  async post(request: FactoryPlanApprovalRequest): Promise<ReadonlySet<string>> {
    const carded = new Set<string>();
    const channels = this.#deps.channels();
    if (!channels) return carded;
    const target = await this.#target(request);
    for (const recipient of request.recipients) {
      const key = `${request.toolCallId}:${recipient.threadId}`;
      if (this.#posting.has(key)) continue;
      this.#posting.add(key);
      try {
        if (this.#posted.get(request.toolCallId)?.has(recipient.threadId)) {
          carded.add(recipient.threadId);
          continue;
        }
        const render = await channels.buildRenderContextForThread(recipient.threadId);
        if (render?.platform !== 'slack') continue;
        if (await this.#postedBefore(request.toolCallId, recipient.threadId)) {
          carded.add(recipient.threadId);
          continue;
        }
        try {
          const message = await render.chatThread.post({
            card: planApprovalCard(request.plan, target),
            fallbackText: planApprovalText(request.plan, target),
          });
          this.#remember(request.toolCallId, recipient.threadId, { message, plan: request.plan, target });
          carded.add(recipient.threadId);
        } catch (error) {
          console.warn('[Factory Slack] Unable to post a plan approval card; posting it as text.', error);
          await render.chatThread.post({ markdown: planApprovalText(request.plan, target) });
        }
      } catch (error) {
        console.warn('[Factory Slack] Unable to post a plan for approval to the thread.', error);
      } finally {
        this.#posting.delete(key);
      }
    }
    return carded;
  }

  /**
   * Settles every card for the call: no buttons left. `except` is a thread
   * whose card the caller settles itself. Never throws.
   */
  async resolve(toolCallId: string, resolution: PlanCardResolution, except?: string): Promise<void> {
    const by = this.#approvers.get(toolCallId);
    this.#approvers.delete(toolCallId);
    if (resolution.kind === 'approved' && !resolution.by && by) resolution = { kind: 'approved', by };
    const cards = this.#posted.get(toolCallId);
    if (!cards) return;
    this.#posted.delete(toolCallId);
    await Promise.all(
      [...cards].map(async ([threadId, card]) => {
        if (threadId === except) return;
        try {
          await card.message.edit(planResolvedCard(card.plan, card.target, resolution));
        } catch (error) {
          console.warn('[Factory Slack] Unable to settle a plan approval card.', error);
        }
      }),
    );
  }

  /**
   * Names who is approving the call from a card while their answer is sent,
   * so cards settled when the call ends say who approved it. Returns the undo.
   */
  approving(toolCallId: string, by: string): () => void {
    this.#approvers.set(toolCallId, by);
    return () => {
      if (this.#approvers.get(toolCallId) === by) this.#approvers.delete(toolCallId);
    };
  }

  /** What a card for the call says, from any thread it was posted in. */
  posted(toolCallId: string): { plan: PlanDigestResult; target: PlanCardTarget } | undefined {
    const card = this.#posted.get(toolCallId)?.values().next().value;
    return card && { plan: card.plan, target: card.target };
  }

  #remember(toolCallId: string, threadId: string, card: PostedPlanCard) {
    const cards = this.#posted.get(toolCallId) ?? new Map<string, PostedPlanCard>();
    cards.set(threadId, card);
    this.#posted.set(toolCallId, cards);
  }

  async #target(request: FactoryPlanApprovalRequest): Promise<PlanCardTarget> {
    const { sender } = request;
    const row = await this.#deps.sessions.getBySessionId(sender.sessionId).catch(() => null);
    const sessionUrl = sessionLink({
      threadId: sender.threadId,
      sessionId: sender.sessionId,
      resourceId: sender.sessionId,
      factoryProjectId: row?.factoryProjectId ?? undefined,
    });
    return {
      sessionId: sender.sessionId,
      toolCallId: request.toolCallId,
      subject: request.subject,
      ...(sessionUrl ? { sessionUrl } : {}),
    };
  }

  /** Whether a report on the thread says its card for the call was already posted (before a restart). */
  async #postedBefore(toolCallId: string, threadId: string): Promise<boolean> {
    const notifications = await this.#deps.notifications?.();
    if (!notifications) return false;
    const records = await notifications.listNotifications({
      threadId,
      source: FACTORY_SESSION_NOTIFICATION_SOURCE,
      limit: POSTED_SCAN,
    });
    return records.some(
      record => record.attributes?.['plan-card'] === 'posted' && record.attributes?.['tool-call-id'] === toolCallId,
    );
  }
}

/** How a `submit_plan` result says the plan was answered. */
function planResolution(result: unknown): PlanCardResolution | undefined {
  const submitted = (result as { submittedPlan?: { action?: unknown } } | null | undefined)?.submittedPlan;
  if (submitted?.action === 'approved') return { kind: 'approved' };
  if (submitted?.action === 'rejected') return { kind: 'changes-requested' };
  return undefined;
}

/**
 * Settles a session's plan cards when its plan is answered anywhere else: in
 * the web UI, by `factory_answer_approval` (a thread asking for changes), or
 * when the parked call is cancelled.
 */
export function observeSessionPlanCards(session: RunReportSession, cards: PlanApprovalCards): () => void {
  const plans = new Set<string>();
  return session.subscribe((event: AgentControllerEvent) => {
    if (event.type === 'tool_suspended' && event.toolName === SUBMIT_PLAN_TOOL_NAME) {
      plans.add(event.toolCallId);
      return;
    }
    if (event.type === 'tool_suspension_cancelled' && plans.delete(event.toolCallId)) {
      void cards.resolve(event.toolCallId, { kind: 'stale' });
      return;
    }
    if (event.type === 'tool_end' && plans.delete(event.toolCallId)) {
      void cards.resolve(event.toolCallId, planResolution(event.result) ?? { kind: 'stale' });
    }
  });
}
