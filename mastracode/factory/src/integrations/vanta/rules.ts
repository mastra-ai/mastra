import { closeReason } from '../../boards/board-events.js';
import type { BoardEventFacts } from '../../boards/board-events.js';
import { boardForWorkItem, rulePhaseField, withBoardClosure, withIntakeTarget } from '../../boards/index.js';
import type { BoardRegistry } from '../../boards/index.js';
import { toBoardSource } from '../../boards/project-boards.js';
import type { ProjectBoardSource } from '../../boards/project-boards.js';
import { routeEventDecision } from '../../rules/event-rules.js';
import type { FactoryVantaRuleContext, FactoryRuleDecision } from '../../rules/types.js';
import { assertFactoryDecisionTarget, validateFactoryRuleDecisions } from '../../rules/validation.js';
import type { StoredBoardScope } from '../../storage/domains/boards/base.js';
import type { FactoryProjectsStorage } from '../../storage/domains/projects/base.js';
import type { Card, WorkItemsStorage } from '../../storage/domains/work-items/base.js';
import type { IntegrationContext } from '../base.js';
import { cardIngressId, cardsByExternalId } from '../record-cards.js';
import { defaultVantaRules } from './default-rules.js';
import type { VantaEventRules } from './default-rules.js';

const MAX_STALE_RULE_ATTEMPTS = 3;

/** Labels every Vanta card carries, so the Security intake route matches them like any `security`-labeled issue. */
export function vantaLabels(severity: string | null): string[] {
  return ['security', 'vanta', ...(severity ? [`severity:${severity.toLowerCase()}`] : [])];
}

export type VantaVulnerabilityIngress = FactoryVantaRuleContext['vulnerability'];

export interface VantaRulesOptions {
  projects: Pick<FactoryProjectsStorage, 'get'>;
  storage: WorkItemsStorage;
  configVersion: string;
  boards: BoardRegistry | ProjectBoardSource;
  rules?: VantaEventRules;
}

export interface VantaRulesIngress {
  orgId: string;
  userId: string;
  factoryProjectId: string;
  /** Every vulnerability Vanta currently lists as active. Open cards missing from it are closed. */
  vulnerabilities: VantaVulnerabilityIngress[];
}

type IngressStatus = 'committed' | 'replayed' | 'missing';

/** A first sighting of an active vulnerability creates its card; dropping off Vanta's active list closes it. */
export function boardEventFor(context: Pick<FactoryVantaRuleContext, 'event' | 'item'>): BoardEventFacts | undefined {
  if (context.event === 'vulnerabilityClosed') {
    return { type: 'work_item.closed', reason: closeReason(false) };
  }
  return context.item ? undefined : { type: 'work_item.created' };
}

/** The closing ingress for a card whose vulnerability Vanta stopped listing, rebuilt from the card. */
function resolvedFromCard(sourceKey: string, item: Card): VantaVulnerabilityIngress {
  const metadata = item.metadata ?? {};
  const text = (key: string) => (typeof metadata[key] === 'string' ? (metadata[key] as string) : null);
  return {
    id: sourceKey,
    name: text('identifier') ?? sourceKey,
    title: item.title,
    description: null,
    url: item.externalSource?.url ?? null,
    state: 'resolved',
    severity: text('severity'),
    packageIdentifier: text('packageIdentifier'),
    fixable: null,
    remediateBy: text('remediateBy'),
    labels: [],
    createdAt: text('sourceCreatedAt') ?? new Date(0).toISOString(),
  };
}

export class VantaRules {
  readonly #rules: VantaEventRules;

  constructor(private readonly options: VantaRulesOptions) {
    this.#rules = options.rules ?? defaultVantaRules;
  }

  #boards(scope: StoredBoardScope): BoardRegistry {
    return toBoardSource(this.options.boards).forProject(scope);
  }

  async ingest(input: VantaRulesIngress): Promise<{ status: IngressStatus; ingested: number }> {
    const project = await this.options.projects.get({ orgId: input.orgId, id: input.factoryProjectId });
    if (!project) return { status: 'missing', ingested: 0 };
    await toBoardSource(this.options.boards).load(input);

    const items = await this.options.storage.listShared({ orgId: input.orgId, factoryProjectId: input.factoryProjectId });
    const itemsBySourceKey = cardsByExternalId(
      items.filter(
        item => item.externalSource?.integrationId === 'vanta' && item.externalSource.type === 'vulnerability',
      ),
    );
    const statuses: IngressStatus[] = [];
    const active = new Set(input.vulnerabilities.map(vulnerability => vulnerability.id));
    for (const vulnerability of input.vulnerabilities) {
      const cards = itemsBySourceKey.get(vulnerability.id) ?? [];
      if (!cards.length) statuses.push(await this.#ingestAlert(input, vulnerability, undefined));
      // Each board's card runs its own rules for the vulnerability.
      for (const card of cards) {
        statuses.push(await this.#ingestAlert(input, vulnerability, structuredClone(card), 1));
      }
    }
    for (const [sourceKey, cards] of itemsBySourceKey) {
      if (!sourceKey || active.has(sourceKey)) continue;
      for (const item of cards) {
        if (item.metadata?.state === 'resolved') continue;
        statuses.push(
          await this.#ingestAlert(input, resolvedFromCard(sourceKey, item), structuredClone(item), 1),
        );
      }
    }
    if (statuses.includes('committed')) return { status: 'committed', ingested: statuses.length };
    if (statuses.includes('replayed')) return { status: 'replayed', ingested: statuses.length };
    return { status: 'missing', ingested: statuses.length };
  }

  async #ingestAlert(
    input: VantaRulesIngress,
    alert: VantaVulnerabilityIngress,
    relatedItem: Card | undefined,
    attempt = 1,
  ): Promise<IngressStatus> {
    const closed = alert.state === 'resolved';
    // A resolved vulnerability Factory never filed stays off the board.
    if (closed && !relatedItem) return 'missing';

    const ingressId = await cardIngressId(this.options.storage, `vanta:${alert.id}:${alert.state}`, relatedItem);
    const actor = { type: 'human' as const, id: input.userId };
    const event = closed ? 'vulnerabilityClosed' : 'vulnerabilityObserved';
    const boards = this.#boards(input);
    const context: FactoryVantaRuleContext = {
      tenant: { orgId: input.orgId, projectId: input.factoryProjectId },
      actor,
      ingress: { type: 'vanta', id: ingressId },
      cause: `vanta.${event}`,
      causalChain: [],
      configVersion: this.options.configVersion,
      ...(relatedItem
        ? {
            item: {
              id: relatedItem.id,
              source: 'vanta-vulnerability',
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
      vulnerability: alert,
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
        reason: error instanceof Error ? error.message.slice(0, 2_000) : 'Factory Vanta rule failed.',
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
      ingress: { identity: ingressId, triggerType: `vanta.${event}` },
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
        throw new Error(`Factory Vanta rule evaluation for ${ingressId} kept losing revision races.`);
      }
      const fresh = relatedItem ? await this.options.storage.get({ orgId: input.orgId, id: relatedItem.id }) : null;
      if (relatedItem && !fresh) return 'missing';
      return this.#ingestAlert(input, alert, fresh ?? undefined, attempt + 1);
    }
    return committed.status;
  }
}

export function attachVantaRules(
  context: IntegrationContext,
): ((input: VantaRulesIngress) => Promise<unknown>) | undefined {
  if (!context.runtime) return undefined;
  const rules = new VantaRules({
    projects: context.storage.projects,
    storage: context.runtime.workItems,
    configVersion: context.runtime.configVersion,
    boards: context.runtime.boards,
  });
  return input => rules.ingest(input);
}
