import type { BoardEventFacts } from '../../boards/board-events.js';
import { boardForWorkItem, rulePhaseField, withBoardClosure, withIntakeTarget } from '../../boards/index.js';
import type { BoardRegistry } from '../../boards/index.js';
import { toBoardSource } from '../../boards/project-boards.js';
import type { ProjectBoardSource } from '../../boards/project-boards.js';
import { routeEventDecision } from '../../rules/event-rules.js';
import type {
  FactoryPlatformAlertEventName,
  FactoryPlatformAlertRuleContext,
  FactoryRuleDecision,
  PlatformAlertEvent,
} from '../../rules/types.js';
import { assertFactoryDecisionTarget, validateFactoryRuleDecisions } from '../../rules/validation.js';
import type { StoredBoardScope } from '../../storage/domains/boards/base.js';
import type { FactoryProjectsStorage } from '../../storage/domains/projects/base.js';
import { WorkItemSourceConflictError } from '../../storage/domains/work-items/base.js';
import type { Card, ExternalWorkItemSource, WorkItemsStorage } from '../../storage/domains/work-items/base.js';
import type { IntegrationContext } from '../base.js';
import { alertLabels, defaultPlatformAlertRules } from './default-rules.js';
import type { PlatformAlertEventRules } from './default-rules.js';
import { alertGeneration, alertSourceKey, alertWorkKey, planAlertEvent } from './state.js';
import type {
  AlertCardState,
  AlertCardView,
  AlertPlan,
  AlertSeverity,
  AlertSlackThread,
  AlertTimelineEntry,
} from './state.js';

const MAX_STALE_RULE_ATTEMPTS = 3;
export const ALERT_INTEGRATION_ID = 'mastra-alerts';
export const DEFAULT_ALERT_SEVERITY_FLOOR: AlertSeverity = 'error';

export interface PlatformAlertRulesOptions {
  projects: Pick<FactoryProjectsStorage, 'get'>;
  storage: WorkItemsStorage;
  configVersion: string;
  boards: BoardRegistry | ProjectBoardSource;
  rules?: PlatformAlertEventRules;
  severityFloor?: AlertSeverity;
  now?: () => Date;
  /**
   * Told after the alert's Slack thread is attached to a card, e.g. to bind runs that started
   * before the thread was known. Failures are logged, never fatal.
   */
  onThreadAttached?: (card: Card) => Promise<void>;
  /** Told when an event records a recovery on a card. Failures are logged, never fatal. */
  onRecovered?: (card: Card, at: Date) => Promise<void>;
}

/** Early resolves held at most; the oldest goes first. */
const MAX_EARLY_RESOLVES = 1_000;

export interface PlatformAlertRulesIngress {
  orgId: string;
  userId: string;
  factoryProjectId: string;
  event: PlatformAlertEvent;
  /** This project's floor for this event, when its binding sets one; else the rules' own floor. */
  severityFloor?: AlertSeverity;
  /**
   * False when this project's binding doesn't take the event: it still lands on a card the project
   * already holds, but files none (a raise on an incident filed elsewhere). Default true.
   */
  createCards?: boolean;
}

export interface AlertCardRef {
  workItemId: string;
  board: string;
}

export type PlatformAlertIngestResult =
  | { status: 'missing' | 'remembered' }
  /** Applied before; `card` is the alert's card when one exists, so the caller can still ack. */
  | { status: 'replayed'; card?: AlertCardRef }
  /**
   * The card is committed but the dispatcher hasn't filed it yet. The caller must not move past this
   * event: later events for the alert need the card to land on.
   */
  | { status: 'pending' }
  | { status: 'rejected'; code: string }
  | {
      status: 'committed';
      workItemId: string;
      board: string;
      created: boolean;
      reopened: boolean;
      /** The alert's Slack thread, when this event is the one that first gave the card one. */
      bindThread?: AlertSlackThread;
    };

/** The card metadata keys this source owns. */
export const ALERT_STATE_KEY = 'alert';
export const ALERT_TIMELINE_KEY = 'alertTimeline';

function readState(card: Card): AlertCardState | null {
  const state = card.metadata?.[ALERT_STATE_KEY];
  return state && typeof state === 'object' ? (state as AlertCardState) : null;
}

function readTimeline(card: Card): AlertTimelineEntry[] {
  const timeline = card.metadata?.[ALERT_TIMELINE_KEY];
  return Array.isArray(timeline) ? (timeline as AlertTimelineEntry[]) : [];
}

function eventName(plan: AlertPlan, event: PlatformAlertEvent): FactoryPlatformAlertEventName {
  if (plan.kind === 'create' || (plan.kind === 'reject' && event.type === 'alert.opened')) return 'alertOpened';
  switch (event.type) {
    case 'alert.opened':
      return 'alertRefired';
    case 'alert.severity_raised':
      return 'alertSeverityRaised';
    case 'alert.resolved':
      return 'alertResolved';
    case 'alert.thread_linked':
      return 'alertThreadLinked';
  }
}

/**
 * Applies Mastra Alerts events to one Factory project: one card per alert rule, kept across
 * re-fires (see `state.ts`). Every event commits under `platform-alert:<eventId>`, so a redelivered
 * or concurrently polled event replays instead of applying twice.
 */
export class PlatformAlertRules {
  readonly #rules: PlatformAlertEventRules;
  /**
   * Resolves that arrived before any card held their incident, by `org:incident`. Platform's log
   * orders an incident's events, so this only covers a resolve replayed ahead of its open; held in
   * memory and bounded, a lost entry just means the later open counts as a fire.
   */
  readonly #earlyResolves = new Map<string, string>();

  constructor(private readonly options: PlatformAlertRulesOptions) {
    this.#rules = options.rules ?? defaultPlatformAlertRules;
  }

  #boards(scope: StoredBoardScope): BoardRegistry {
    return toBoardSource(this.options.boards).forProject(scope);
  }

  #now(): Date {
    return this.options.now?.() ?? new Date();
  }

  /** The newest card filed for this alert's work key in the project. */
  async #latestCard(
    input: PlatformAlertRulesIngress,
    workKey: string,
  ): Promise<{ card: Card; generation: number } | null> {
    const items = await this.options.storage.listShared({
      orgId: input.orgId,
      factoryProjectId: input.factoryProjectId,
    });
    let latest: { card: Card; generation: number } | null = null;
    for (const card of items) {
      const keys = [
        ...card.workItem.sources
          .filter(source => source.integrationId === ALERT_INTEGRATION_ID)
          .map(source => source.externalId),
        ...(card.externalSource?.integrationId === ALERT_INTEGRATION_ID ? [card.externalSource.externalId] : []),
      ];
      for (const key of keys) {
        const generation = alertGeneration(key, workKey);
        if (generation !== null && (!latest || generation > latest.generation)) latest = { card, generation };
      }
    }
    return latest;
  }

  #view(card: Card, boards: BoardRegistry): AlertCardView | null {
    const state = readState(card);
    if (!state) return null;
    const terminal = withBoardClosure(boards, card).boardClosure?.itemTerminal ?? false;
    const entered = card.stageHistory.at(-1)?.enteredAt;
    return {
      id: card.id,
      state,
      timeline: readTimeline(card),
      terminal,
      terminalSince: terminal && entered ? new Date(entered).toISOString() : null,
    };
  }

  async ingest(input: PlatformAlertRulesIngress, attempt = 1): Promise<PlatformAlertIngestResult> {
    const { event } = input;
    // A Factory project only takes its own organization's alerts.
    if (event.organizationId !== input.orgId) return { status: 'missing' };
    const project = await this.options.projects.get({ orgId: input.orgId, id: input.factoryProjectId });
    if (!project) return { status: 'missing' };
    await toBoardSource(this.options.boards).load(input);
    const boards = this.#boards(input);

    const workKey = alertWorkKey(event.workKey);
    const latest = await this.#latestCard(input, workKey);
    const view = latest ? this.#view(latest.card, boards) : null;
    const earlyKey = `${input.orgId}:${event.incident.id}`;
    const resolvedEarly = this.#earlyResolves.get(earlyKey);
    const plan = planAlertEvent({
      event,
      card: view,
      now: this.#now(),
      severityFloor: input.severityFloor ?? this.options.severityFloor ?? DEFAULT_ALERT_SEVERITY_FLOOR,
      ...(resolvedEarly ? { resolvedEarly } : {}),
    });

    if (plan.kind === 'create' && input.createCards === false) return { status: 'missing' };
    if (plan.kind === 'noop') {
      if (plan.reason !== 'replayed' || !latest) return { status: 'missing' };
      return { status: 'replayed', card: { workItemId: latest.card.id, board: boardForWorkItem(latest.card) } };
    }
    if (plan.kind === 'remember_resolve') {
      this.#earlyResolves.delete(earlyKey);
      this.#earlyResolves.set(earlyKey, plan.resolvedAt);
      if (this.#earlyResolves.size > MAX_EARLY_RESOLVES) {
        this.#earlyResolves.delete(this.#earlyResolves.keys().next().value!);
      }
      return { status: 'remembered' };
    }

    const ingressId = `platform-alert:${event.eventId}`;
    const actor = { type: 'human' as const, id: input.userId };
    const name = eventName(plan, event);
    const card = plan.kind === 'update' ? latest?.card : undefined;
    const context: FactoryPlatformAlertRuleContext = {
      tenant: { orgId: input.orgId, projectId: input.factoryProjectId },
      actor,
      ingress: { type: 'platform-alert', id: ingressId },
      cause: `platform-alert.${name}`,
      causalChain: [],
      configVersion: this.options.configVersion,
      ...(card
        ? {
            item: {
              id: card.id,
              source: 'platform-alert',
              sourceKey: card.externalSource?.externalId ?? null,
              parentWorkItemId: card.parentWorkItemId,
              title: card.title,
              url: card.externalSource?.url ?? null,
              stages: card.stages,
              workItem: card.workItem,
              acceptedAt: card.acceptedAt,
              metadata: card.metadata,
            },
            board: boardForWorkItem(card),
            itemRevision: card.revision,
            ...withBoardClosure(boards, card),
            ...rulePhaseField(boards, card),
          }
        : {}),
      ...withIntakeTarget(boards),
      event: name,
      alert: event,
      sourceKey: alertSourceKey(workKey, plan.kind === 'create' ? plan.state.generation : (latest?.generation ?? 1)),
      ...(plan.kind === 'create' && plan.state.previousCardId ? { previousCardId: plan.state.previousCardId } : {}),
      severityFloor: input.severityFloor ?? this.options.severityFloor ?? DEFAULT_ALERT_SEVERITY_FLOOR,
    };
    const boardEvent: BoardEventFacts | undefined =
      plan.kind === 'create'
        ? { type: 'work_item.opened' }
        : plan.kind === 'update' && plan.reopen
          ? { type: 'work_item.reopened' }
          : undefined;
    if (boardEvent) context.boardEvent = boardEvent;

    let decisions: Record<string, unknown>[] = [];
    let outcome: { status: 'accepted' | 'rejected'; code?: string; reason?: string } = { status: 'accepted' };
    if (plan.kind === 'reject') {
      outcome = { status: 'rejected', code: plan.code, reason: plan.reason };
    } else {
      try {
        const rule = this.#rules[name];
        const decision: FactoryRuleDecision | void = rule ? await rule(Object.freeze(context)) : undefined;
        if (decision?.type === 'reject') {
          outcome = { status: 'rejected', code: decision.code, reason: decision.reason };
        } else if (decision) {
          const withState =
            decision.type === 'upsertLinkedWorkItem' && plan.kind === 'create'
              ? {
                  ...decision,
                  metadata: {
                    ...decision.metadata,
                    [ALERT_STATE_KEY]: plan.state,
                    [ALERT_TIMELINE_KEY]: plan.timeline,
                  },
                }
              : decision;
          decisions = validateFactoryRuleDecisions([withState]).map(entry => {
            assertFactoryDecisionTarget(entry, boards, card ? boardForWorkItem(card) : undefined);
            return { ...entry };
          });
        } else if (plan.kind === 'update' && plan.reopen) {
          const routed = await routeEventDecision(context, this.options.storage, {
            orgId: input.orgId,
            factoryProjectId: input.factoryProjectId,
          });
          if (routed) decisions = [{ ...routed }];
        }
      } catch (error) {
        outcome = {
          status: 'rejected',
          code: 'rule_error',
          reason: error instanceof Error ? error.message.slice(0, 2_000) : 'Mastra Alerts rule failed.',
        };
      }
    }

    const committed = await this.options.storage.commitRuleEvaluation({
      orgId: input.orgId,
      factoryProjectId: input.factoryProjectId,
      workItemId: card?.id ?? null,
      ingress: { identity: ingressId },
      expectedRevision: card?.revision ?? null,
      actor,
      outcome,
      decisions,
      causalChain: [],
      now: this.#now(),
      // The alert state lands with the commit, at the revision it was planned from; a card that
      // moved meanwhile reports `stale` and the event is planned again.
      ...(card && plan.kind === 'update' && outcome.status === 'accepted'
        ? {
            cardMetadata: {
              userId: input.userId,
              metadata: {
                labels: alertLabels({ ...event, incident: { ...event.incident, severity: plan.state.severity } }),
                severity: plan.state.severity,
                [ALERT_STATE_KEY]: plan.state,
                [ALERT_TIMELINE_KEY]: plan.timeline,
              },
            },
          }
        : {}),
    });
    if (committed.status === 'stale') {
      if (attempt >= MAX_STALE_RULE_ATTEMPTS) {
        throw new Error(`Mastra Alerts rule evaluation for ${ingressId} kept losing revision races.`);
      }
      return this.ingest(input, attempt + 1);
    }
    if (committed.status === 'missing') return { status: 'missing' };
    // A create that replays has no card yet (else the planner would have seen it): still being filed.
    if (committed.status === 'replayed') return plan.kind === 'create' ? { status: 'pending' } : { status: 'replayed' };
    if (outcome.status === 'rejected') return { status: 'rejected', code: outcome.code ?? 'rejected' };
    this.#earlyResolves.delete(earlyKey);

    if (plan.kind === 'create') {
      const filed = await this.#latestCard(input, workKey);
      if (!filed || filed.generation !== plan.state.generation) return { status: 'pending' };
      return {
        status: 'committed',
        workItemId: filed.card.id,
        board: boardForWorkItem(filed.card),
        created: true,
        reopened: false,
        ...(plan.state.slackThread ? { bindThread: plan.state.slackThread } : {}),
      };
    }
    if (!card || plan.kind !== 'update') return { status: 'missing' };
    if (
      this.options.onRecovered &&
      input.event.type === 'alert.resolved' &&
      plan.timeline.at(-1)?.kind === 'recovered'
    ) {
      const recovered = await this.options.storage.get({ orgId: input.orgId, id: card.id });
      if (recovered) {
        await this.options.onRecovered(recovered, this.#now()).catch(error => {
          console.warn('[mastra-alerts] recording the recovery in Slack failed', {
            workItemId: card.id,
            error: error instanceof Error ? error.message : String(error),
          });
        });
      }
    }
    if (plan.bindThread) {
      // The alert's Slack thread joins the card as an attached source, so a mention there finds it.
      try {
        await this.options.storage.attachSource({
          orgId: input.orgId,
          id: card.id,
          source: alertThreadSource(plan.bindThread),
          metadata: null,
        });
      } catch (error) {
        if (!(error instanceof WorkItemSourceConflictError)) throw error;
      }
      if (this.options.onThreadAttached) {
        const attached = await this.options.storage.get({ orgId: input.orgId, id: card.id });
        if (attached) {
          await this.options.onThreadAttached(attached).catch(error => {
            console.warn('[mastra-alerts] binding runs to the alert thread failed', {
              workItemId: card.id,
              error: error instanceof Error ? error.message : String(error),
            });
          });
        }
      }
    }
    return {
      status: 'committed',
      workItemId: card.id,
      board: boardForWorkItem(card),
      created: false,
      reopened: plan.reopen,
      ...(plan.bindThread ? { bindThread: plan.bindThread } : {}),
    };
  }
}

/** The card source for an alert's Slack thread; `externalId` is the chat thread id. */
export function alertThreadSource(thread: AlertSlackThread): ExternalWorkItemSource {
  return {
    integrationId: 'slack',
    type: 'slack-thread',
    workspaceId: thread.teamId,
    externalId: `slack:${thread.channelId}:${thread.ts}`,
  };
}

/** The open Mastra Alerts card a Slack thread belongs to, or null. */
export async function findAlertCardForThread(
  storage: Pick<WorkItemsStorage, 'getBySource'>,
  thread: { teamId: string; threadId: string },
): Promise<Card | null> {
  const card = await storage.getBySource({
    integrationId: 'slack',
    type: 'slack-thread',
    workspaceId: thread.teamId,
    externalId: thread.threadId,
  });
  return card?.externalSource?.integrationId === ALERT_INTEGRATION_ID ? card : null;
}

export function attachPlatformAlertRules(
  context: IntegrationContext,
  hooks: Pick<PlatformAlertRulesOptions, 'onThreadAttached' | 'onRecovered'> = {},
): ((input: PlatformAlertRulesIngress) => Promise<PlatformAlertIngestResult>) | undefined {
  if (!context.runtime) return undefined;
  const rules = new PlatformAlertRules({
    projects: context.storage.projects,
    storage: context.runtime.workItems,
    configVersion: context.runtime.configVersion,
    boards: context.runtime.boards,
    ...hooks,
  });
  return input => rules.ingest(input);
}
