import { closeReason } from '../../boards/board-events.js';
import type { BoardEventFacts } from '../../boards/board-events.js';
import { boardForWorkItem, rulePhaseField, withBoardClosure, withIntakeTarget } from '../../boards/index.js';
import type { BoardRegistry } from '../../boards/index.js';
import { toBoardSource } from '../../boards/project-boards.js';
import type { ProjectBoardSource } from '../../boards/project-boards.js';
import { routeEventDecision } from '../../rules/event-rules.js';
import type { FactoryDependabotRuleContext, FactoryRuleDecision } from '../../rules/types.js';
import { assertFactoryDecisionTarget, validateFactoryRuleDecisions } from '../../rules/validation.js';
import type { StoredBoardScope } from '../../storage/domains/boards/base.js';
import type { FactoryProjectsStorage } from '../../storage/domains/projects/base.js';
import type { Card, WorkItemsStorage } from '../../storage/domains/work-items/base.js';
import type { IntegrationContext } from '../base.js';
import { defaultDependabotRules, isClosedDependabotState } from './default-rules.js';
import type { DependabotEventRules } from './default-rules.js';

const MAX_STALE_RULE_ATTEMPTS = 3;

/** Labels every Dependabot card carries, so intake routes can match them like any labeled issue. */
export function dependabotLabels(severity: string | null): string[] {
  return ['security', 'dependabot', ...(severity ? [`severity:${severity}`] : [])];
}

export type DependabotAlertIngress = FactoryDependabotRuleContext['alert'];

export interface DependabotRulesOptions {
  projects: Pick<FactoryProjectsStorage, 'get'>;
  storage: WorkItemsStorage;
  configVersion: string;
  boards: BoardRegistry | ProjectBoardSource;
  rules?: DependabotEventRules;
}

export interface DependabotRulesIngress {
  orgId: string;
  userId: string;
  factoryProjectId: string;
  alerts: DependabotAlertIngress[];
}

type IngressStatus = 'committed' | 'replayed' | 'missing';

/**
 * A first sighting of an open alert creates its card; a fixed or dismissed one closes it. An open
 * alert that already has a card reopens it, which the intake routes apply only to a finished card.
 */
export function boardEventFor(
  context: Pick<FactoryDependabotRuleContext, 'event' | 'alert' | 'item'>,
): BoardEventFacts | undefined {
  if (context.event === 'alertClosed') {
    return { type: 'work_item.closed', reason: closeReason(context.alert.state !== 'fixed') };
  }
  return context.item ? { type: 'work_item.reopened' } : { type: 'work_item.created' };
}

export class DependabotRules {
  readonly #rules: DependabotEventRules;

  constructor(private readonly options: DependabotRulesOptions) {
    this.#rules = options.rules ?? defaultDependabotRules;
  }

  #boards(scope: StoredBoardScope): BoardRegistry {
    return toBoardSource(this.options.boards).forProject(scope);
  }

  async ingest(input: DependabotRulesIngress): Promise<{ status: IngressStatus; ingested: number }> {
    const project = await this.options.projects.get({ orgId: input.orgId, id: input.factoryProjectId });
    if (!project) return { status: 'missing', ingested: 0 };
    await toBoardSource(this.options.boards).load(input);

    const items = await this.options.storage.listShared({
      orgId: input.orgId,
      factoryProjectId: input.factoryProjectId,
    });
    const itemsBySourceKey = new Map(
      items
        .filter(
          item => item.externalSource?.integrationId === 'github' && item.externalSource.type === 'dependabot-alert',
        )
        .map(item => [item.externalSource?.externalId, item]),
    );
    const statuses: IngressStatus[] = [];
    for (const alert of input.alerts) {
      const relatedItem = itemsBySourceKey.get(alert.id);
      statuses.push(await this.#ingestAlert(input, alert, relatedItem && structuredClone(relatedItem)));
    }
    if (statuses.includes('committed')) return { status: 'committed', ingested: statuses.length };
    if (statuses.includes('replayed')) return { status: 'replayed', ingested: statuses.length };
    return { status: 'missing', ingested: statuses.length };
  }

  async #ingestAlert(
    input: DependabotRulesIngress,
    alert: DependabotAlertIngress,
    relatedItem: Card | undefined,
    attempt = 1,
  ): Promise<IngressStatus> {
    const closed = isClosedDependabotState(alert.state);
    // A closed alert Factory never filed stays off the board.
    if (closed && !relatedItem) return 'missing';

    const ingressId = `dependabot:${alert.id}:${alert.state}:${alert.updatedAt}`;
    const actor = { type: 'human' as const, id: input.userId };
    const event = closed ? 'alertClosed' : 'alertObserved';
    const boards = this.#boards(input);
    const context: FactoryDependabotRuleContext = {
      tenant: { orgId: input.orgId, projectId: input.factoryProjectId },
      actor,
      ingress: { type: 'github', id: ingressId },
      cause: `dependabot.${event}`,
      causalChain: [],
      configVersion: this.options.configVersion,
      ...(relatedItem
        ? {
            item: {
              id: relatedItem.id,
              source: 'github-dependabot-alert',
              sourceKey: relatedItem.externalSource?.externalId ?? null,
              parentWorkItemId: relatedItem.parentWorkItemId,
              title: relatedItem.title,
              url: relatedItem.externalSource?.url ?? null,
              stages: relatedItem.stages,
              workItem: relatedItem.workItem,
              acceptedAt: relatedItem.acceptedAt,
              metadata: relatedItem.metadata,
            },
            board: boardForWorkItem(relatedItem),
            itemRevision: relatedItem.revision,
            ...withBoardClosure(boards, relatedItem),
            ...rulePhaseField(boards, relatedItem),
          }
        : {}),
      ...withIntakeTarget(boards),
      event,
      alert,
    };
    const boardEvent = boardEventFor(context);
    if (boardEvent) context.boardEvent = boardEvent;

    const rule = this.#rules[event];
    let decision: FactoryRuleDecision | void = undefined;
    let decisions: Record<string, unknown>[] = [];
    let outcome: { status: 'accepted' | 'rejected'; code?: string; reason?: string } = { status: 'accepted' };
    try {
      decision = rule ? await rule(Object.freeze(context)) : undefined;
      if (decision?.type === 'reject') {
        outcome = { status: 'rejected', code: decision.code, reason: decision.reason };
      } else if (decision) {
        decisions = validateFactoryRuleDecisions([decision]).map(entry => {
          assertFactoryDecisionTarget(entry, boards, relatedItem ? boardForWorkItem(relatedItem) : undefined);
          return { ...entry };
        });
      }
    } catch (error) {
      outcome = {
        status: 'rejected',
        code: 'rule_error',
        reason: error instanceof Error ? error.message.slice(0, 2_000) : 'Factory Dependabot rule failed.',
      };
    }
    if (!decision && outcome.status === 'accepted') {
      const routed = await routeEventDecision(context, this.options.storage, {
        orgId: input.orgId,
        factoryProjectId: input.factoryProjectId,
      });
      if (routed) decisions = [{ ...routed }];
    }

    const committed = await this.options.storage.commitRuleEvaluation({
      orgId: input.orgId,
      factoryProjectId: input.factoryProjectId,
      workItemId: relatedItem?.id ?? null,
      ingress: { identity: ingressId, triggerType: `dependabot.${event}` },
      configVersion: this.options.configVersion,
      expectedRevision: relatedItem?.revision ?? null,
      actor,
      outcome,
      decisions,
      causalChain: [],
      now: new Date(),
    });
    if (committed.status === 'stale') {
      if (attempt >= MAX_STALE_RULE_ATTEMPTS) {
        throw new Error(`Factory Dependabot rule evaluation for ${ingressId} kept losing revision races.`);
      }
      const fresh = relatedItem ? await this.options.storage.get({ orgId: input.orgId, id: relatedItem.id }) : null;
      if (relatedItem && !fresh) return 'missing';
      return this.#ingestAlert(input, alert, fresh ?? undefined, attempt + 1);
    }
    return committed.status;
  }
}

export function attachDependabotRules(
  context: IntegrationContext,
): ((input: DependabotRulesIngress) => Promise<unknown>) | undefined {
  if (!context.runtime) return undefined;
  const rules = new DependabotRules({
    projects: context.storage.projects,
    storage: context.runtime.workItems,
    configVersion: context.runtime.configVersion,
    boards: context.runtime.boards,
  });
  return input => rules.ingest(input);
}
