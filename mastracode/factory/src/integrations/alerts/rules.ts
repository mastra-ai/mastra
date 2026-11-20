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

  /**
   * The card an event lands on: the one that filed its incident, so a late resolve or raise reaches
   * the card it belongs to, else the alert's newest card, where a new fire goes.
   */
  async #targetCard(
    input: PlatformAlertRulesIngress,
    workKey: string,
  ): Promise<{ card: Card; generation: number } | null> {
    const cards = await this.#alertCards(input, workKey);
    const owner = cards.find(({ card }) => readState(card)?.incidents[input.event.incident.id]?.openedAt);
    return owner ?? cards[0] ?? null;
  }

  /** The newest card filed for this alert's work key in the project. */
  async #latestCard(
    input: PlatformAlertRulesIngress,
    workKey: string,
  ): Promise<{ card: Card; generation: number } | null> {
    return (await this.#alertCards(input, workKey))[0] ?? null;
  }

  /** This alert's cards in the project, newest generation first. */
  async #alertCards(
    input: PlatformAlertRulesIngress,
    workKey: string,
  ): Promise<Array<{ card: Card; generation: number }>> {
    const items = await this.options.storage.listShared({
      orgId: input.orgId,
      factoryProjectId: input.factoryProjectId,
    });
    const cards: Array<{ card: Card; generation: number }> = [];
    for (const card of items) {
      const keys = [
        ...card.workItem.sources
          .filter(source => source.integrationId === ALERT_INTEGRATION_ID)
          .map(source => source.externalId),
        ...(card.externalSource?.integrationId === ALERT_INTEGRATION_ID ? [card.externalSource.externalId] : []),
      ];
      const generations = keys.map(key => alertGeneration(key, workKey)).filter(g => g !== null);
      if (generations.length) cards.push({ card, generation: Math.max(...generations) });
    }
    return cards.sort((a, b) => b.generation - a.generation);
  }

  /**
   * Makes sure the card carries its alert's Slack thread as an attached source, so a mention there
   * finds it. Runs on every delivery, a replay included, so an attach that failed is tried again.
   */
  async #attachThread(input: PlatformAlertRulesIngress, card: Card): Promise<void> {
    const thread = readState(card)?.slackThread;
    if (!thread) return;
    const source = alertThreadSource(thread);
    const attached = card.workItem.sources.some(
      s => s.integrationId === source.integrationId && s.sourceType === source.type && s.externalId === source.externalId,
    );
    if (attached) return;
    try {
      await this.options.storage.attachSource({ orgId: input.orgId, id: card.id, source, metadata: null });
    } catch (error) {
      // Another card already holds the thread: nothing to bind here.
      if (error instanceof WorkItemSourceConflictError) return;
      throw error;
    }
    if (!this.options.onThreadAttached) return;
    const fresh = await this.options.storage.get({ orgId: input.orgId, id: card.id });
    if (fresh) await nonFatal('binding runs to the alert thread', card.id, () => this.options.onThreadAttached!(fresh));
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

  /**
   * `merging` re-applies an initial fire whose card another initial fire filed first: the dispatcher
   * reused that card without this fire's alert state, so it lands as a fire on the card instead.
   */
  async ingest(input: PlatformAlertRulesIngress, attempt = 1, merging = false): Promise<PlatformAlertIngestResult> {
    const { event } = input;
    // A Factory project only takes its own organization's alerts.
    if (event.organizationId !== input.orgId) return { status: 'missing' };
    const project = await this.options.projects.get({ orgId: input.orgId, id: input.factoryProjectId });
    if (!project) return { status: 'missing' };
    await toBoardSource(this.options.boards).load(input);
    const boards = this.#boards(input);

    const workKey = alertWorkKey(event.workKey);
    const latest = await this.#targetCard(input, workKey);
    const view = latest ? this.#view(latest.card, boards) : null;
    const earlyKey = `${input.orgId}:${event.incident.id}`;
    const resolvedEarly = this.#earlyResolves.get(earlyKey);
    const plan = planAlertEvent({
      event,
      card: view,
      now: this.#now(),
      severityFloor: this.options.severityFloor ?? DEFAULT_ALERT_SEVERITY_FLOOR,
      ...(resolvedEarly ? { resolvedEarly } : {}),
    });

    if (plan.kind === 'noop') {
      if (plan.reason !== 'replayed' || !latest) return { status: 'missing' };
      await this.#attachThread(input, latest.card);
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

    const ingressId = `platform-alert:${event.eventId}${merging ? ':merge' : ''}`;
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
      severityFloor: this.options.severityFloor ?? DEFAULT_ALERT_SEVERITY_FLOOR,
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
      return this.ingest(input, attempt + 1, merging);
    }
    if (committed.status === 'missing') return { status: 'missing' };
    if (committed.status === 'replayed') {
      const prior = committed.result;
      const queued = Array.isArray(prior.decisions) && prior.decisions.length > 0;
      if (plan.kind === 'create') {
        // A create that replays has no card yet (else the planner would have seen it): still being
        // filed, unless the rules queued no card at all.
        return prior.status === 'accepted' && queued ? { status: 'pending' } : NOT_FILED;
      }
      // This event first planned a create, but its card was filed by another initial fire, without
      // this one's alert state (the planner didn't find the event on it): apply it as a fire.
      if (!merging && prior.status === 'accepted' && prior.itemId == null && queued) {
        return this.ingest(input, 1, true);
      }
      if (card) await this.#attachThread(input, card);
      return { status: 'replayed' };
    }
    if (outcome.status === 'rejected') return { status: 'rejected', code: outcome.code ?? 'rejected' };
    this.#earlyResolves.delete(earlyKey);

    if (plan.kind === 'create') {
      if (decisions.length === 0) return NOT_FILED;
      const filed = await this.#latestCard(input, workKey);
      if (!filed || filed.generation !== plan.state.generation) return { status: 'pending' };
      if (!readState(filed.card)?.seenEventIds.includes(event.eventId)) return this.ingest(input, 1, true);
      await this.#attachThread(input, filed.card);
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
    const updated = await this.options.storage.get({ orgId: input.orgId, id: card.id });
    if (updated && plan.recovered && this.options.onRecovered) {
      const onRecovered = this.options.onRecovered;
      await nonFatal('recording the recovery in Slack', card.id, () => onRecovered(updated, this.#now()));
    }
    if (updated) await this.#attachThread(input, updated);
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

/** Rules accepted the event but queued no card: nothing to wait for. */
const NOT_FILED: PlatformAlertIngestResult = { status: 'rejected', code: 'not_filed' };

/** Runs a hook whose failure, thrown or rejected, must not fail an event that already committed. */
async function nonFatal(what: string, workItemId: string, hook: () => Promise<void>): Promise<void> {
  try {
    await hook();
  } catch (error) {
    console.warn(`[mastra-alerts] ${what} failed`, {
      workItemId,
      error: error instanceof Error ? error.message : String(error),
    });
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
