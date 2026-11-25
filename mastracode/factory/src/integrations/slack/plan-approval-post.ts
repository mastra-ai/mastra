import type { AgentControllerEvent } from '@mastra/core/agent-controller';
import type { AgentChannels } from '@mastra/core/channels';
import type { NotificationsStorage } from '@mastra/core/notifications';
import type { SentMessage } from 'chat';

import type { SourceControlSessionLookup } from '../../session/factory-session.js';
import type { IntegrationStorageHandle } from '../../storage/domains/integrations/base.js';
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

/** Where the durable record of each posted card lives, keyed per call. */
const planCardTarget = (toolCallId: string) => `factory-plan-card:${toolCallId}`;

/** What a stored card record keeps: enough to find the card and settle it after a restart. */
interface StoredPlanCard {
  messageId: string;
  title?: string;
  path: string;
  subject: string;
  sessionId: string;
  sessionUrl?: string;
}

/** Durable records of posted cards, so a card can be settled from another process or after a restart. */
export type PlanCardStore = Pick<IntegrationStorageHandle['subscriptions'], 'create' | 'listByTarget' | 'delete'>;

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
  /** Keeps where each card was posted, so it can lose its Approve button after a restart. */
  store?: () => PlanCardStore | null | undefined;
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
    const { target, orgId } = await this.#target(request);
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
          if (orgId) await this.#store(orgId, request, recipient.threadId, message.id, target);
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
    const cards = this.#posted.get(toolCallId) ?? new Map<string, PostedPlanCard>();
    this.#posted.delete(toolCallId);
    const stored = await this.#stored(toolCallId);
    await Promise.all([
      ...[...cards].map(async ([threadId, card]) => {
        if (threadId === except) return;
        try {
          await card.message.edit(planResolvedCard(card.plan, card.target, resolution));
        } catch (error) {
          console.warn('[Factory Slack] Unable to settle a plan approval card.', error);
        }
      }),
      // Cards this process didn't post, or posted before a restart: edit them through the thread.
      ...stored.map(async record => {
        const threadId = record.threadId;
        try {
          if (threadId && threadId !== except && !cards.has(threadId)) {
            const render = await this.#deps.channels()?.buildRenderContextForThread(threadId);
            if (render?.platform === 'slack') {
              const { plan, target } = storedCard(toolCallId, record.data);
              await render.adapter.editMessage(
                render.chatThread.id,
                record.data.messageId,
                planResolvedCard(plan, target, resolution),
              );
            }
          }
          await this.#deps.store?.()?.delete(record.id);
        } catch (error) {
          console.warn('[Factory Slack] Unable to settle a plan approval card.', error);
        }
      }),
    ]);
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

  async #store(
    orgId: string,
    request: FactoryPlanApprovalRequest,
    threadId: string,
    messageId: string,
    target: PlanCardTarget,
  ): Promise<void> {
    const store = this.#deps.store?.();
    if (!store) return;
    const data: StoredPlanCard = {
      messageId,
      path: request.plan.path,
      ...(request.plan.ok && request.plan.title ? { title: request.plan.title } : {}),
      subject: target.subject,
      sessionId: target.sessionId,
      ...(target.sessionUrl ? { sessionUrl: target.sessionUrl } : {}),
    };
    await store
      .create({
        orgId,
        targetKey: planCardTarget(request.toolCallId),
        sessionId: request.sender.sessionId,
        threadId,
        data: data as unknown as Record<string, unknown>,
      })
      .catch(error => console.warn('[Factory Slack] Unable to record a posted plan approval card.', error));
  }

  async #stored(toolCallId: string): Promise<{ id: string; threadId: string | null; data: StoredPlanCard }[]> {
    const store = this.#deps.store?.();
    if (!store) return [];
    try {
      const records = await store.listByTarget(planCardTarget(toolCallId));
      return records.flatMap(record => {
        const data = record.data as Partial<StoredPlanCard>;
        return typeof data.messageId === 'string' && typeof data.path === 'string'
          ? [{ id: record.id, threadId: record.threadId, data: data as StoredPlanCard }]
          : [];
      });
    } catch (error) {
      console.warn('[Factory Slack] Unable to read the posted plan approval cards.', error);
      return [];
    }
  }

  async #target(request: FactoryPlanApprovalRequest): Promise<{ target: PlanCardTarget; orgId?: string }> {
    const { sender } = request;
    const row = await this.#deps.sessions.getBySessionId(sender.sessionId).catch(() => null);
    const sessionUrl = sessionLink({
      threadId: sender.threadId,
      sessionId: sender.sessionId,
      resourceId: sender.sessionId,
      factoryProjectId: row?.factoryProjectId ?? undefined,
    });
    return {
      target: {
        sessionId: sender.sessionId,
        toolCallId: request.toolCallId,
        subject: request.subject,
        ...(sessionUrl ? { sessionUrl } : {}),
      },
      ...(row?.orgId ? { orgId: row.orgId } : {}),
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

/** The plan and target a stored card record settles with: its title and link are all a settled card shows. */
function storedCard(toolCallId: string, data: StoredPlanCard): { plan: PlanDigestResult; target: PlanCardTarget } {
  return {
    plan: { ok: true, path: data.path, ...(data.title ? { title: data.title } : {}), phases: [], body: '' },
    target: {
      sessionId: data.sessionId,
      toolCallId,
      subject: data.subject,
      ...(data.sessionUrl ? { sessionUrl: data.sessionUrl } : {}),
    },
  };
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
    // A call parked before a restart is not in `plans`; its answer still says it was a plan.
    if (event.type === 'tool_suspension_cancelled' && plans.delete(event.toolCallId)) {
      void cards.resolve(event.toolCallId, { kind: 'stale' });
      return;
    }
    if (event.type === 'tool_end') {
      const resolution = planResolution(event.result);
      if (plans.delete(event.toolCallId) || resolution) {
        void cards.resolve(event.toolCallId, resolution ?? { kind: 'stale' });
      }
    }
  });
}
