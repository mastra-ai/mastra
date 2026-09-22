import { boardForWorkItem, isTerminalWorkItem } from '../../boards/index.js';
import type { BoardRegistry } from '../../boards/index.js';
import type { FactoryIncidentioRuleContext, FactoryRuleDecision } from '../../rules/types.js';
import { assertFactoryDecisionTarget, validateFactoryRuleDecisions } from '../../rules/validation.js';
import type { FactoryProjectsStorage } from '../../storage/domains/projects/base.js';
import type { WorkItemRow, WorkItemsStorage } from '../../storage/domains/work-items/base.js';
import type { IntegrationContext } from '../base.js';
import { incidentioClaimKey } from './claim.js';
import type { IncidentioEventRules } from './default-rules.js';

const RULE_TIMEOUT_MS = 5_000;

async function withRuleTimeout<T>(promise: Promise<T>): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error('FACTORY_RULE_TIMEOUT')), RULE_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export interface IncidentioIssueIngress {
  /** Stable item reference — the prefixed incident.io follow-up id (`incidentio:follow-up:<ulid>`). */
  id: string;
  identifier: string;
  title: string;
  url: string;
  state: string;
  stateType: string;
  priorityLabel: string;
  assignee: string | null;
  /** Display name of the follow-up creator, when available. */
  author: string | null;
  /** Reference of the incident this follow-up belongs to, when available. */
  incident: string | null;
  labels: string[];
  createdAt: string;
  updatedAt: string;
  /** incident.io source the follow-up was read from; resolves the bound board via `intakeBoards`. */
  sourceId?: string | null;
}

export interface IncidentioRulesOptions {
  projects: Pick<FactoryProjectsStorage, 'get'>;
  storage: WorkItemsStorage;
  configVersion: string;
  boards: BoardRegistry;
  incidentioRules: IncidentioEventRules;
}

export interface IncidentioRulesIngress {
  orgId: string;
  userId: string;
  factoryProjectId: string;
  issues: IncidentioIssueIngress[];
  /** Board id per bound incident.io source id, from the project's intake bindings. */
  intakeBoards?: Readonly<Record<string, string>>;
}

type IngressStatus = 'committed' | 'replayed' | 'missing';

export class IncidentioRules {
  constructor(private readonly options: IncidentioRulesOptions) {}

  async ingest(input: IncidentioRulesIngress): Promise<{ status: IngressStatus; ingested: number }> {
    const project = await this.options.projects.get({ orgId: input.orgId, id: input.factoryProjectId });
    if (!project) return { status: 'missing', ingested: 0 };

    const items = await this.options.storage.list({ orgId: input.orgId, factoryProjectId: input.factoryProjectId });
    const itemsBySourceKey = new Map(items.map(item => [item.externalSource?.externalId, item]));
    const itemsByClaimKey = new Map(items.filter(item => item.claimKey).map(item => [item.claimKey, item]));
    const statuses: IngressStatus[] = [];
    for (const issue of input.issues) {
      // The claim finds the card even after a metadata drift; the raw item
      // reference covers cards filed before claims existed.
      const relatedItem = itemsByClaimKey.get(incidentioClaimKey(issue.id)) ?? itemsBySourceKey.get(issue.id);
      // One live card per follow-up per org. The store's claim index is the
      // guarantee; this check spares the dispatcher a refused upsert.
      if (!relatedItem && (await this.#heldElsewhere(input, issue))) {
        statuses.push('missing');
        continue;
      }
      statuses.push(await this.#ingestIssue(input, issue, relatedItem));
    }
    if (statuses.some(status => status === 'committed')) return { status: 'committed', ingested: statuses.length };
    if (statuses.some(status => status === 'replayed')) return { status: 'replayed', ingested: statuses.length };
    return { status: 'missing', ingested: statuses.length };
  }

  async #heldElsewhere(input: IncidentioRulesIngress, issue: IncidentioIssueIngress): Promise<boolean> {
    const heldLive = (row: WorkItemRow) =>
      row.factoryProjectId !== input.factoryProjectId && !isTerminalWorkItem(this.options.boards, row);
    const claimant = await this.options.storage.getByClaimKey({
      orgId: input.orgId,
      claimKey: incidentioClaimKey(issue.id),
    });
    if (claimant && heldLive(claimant)) return true;
    // Cards filed before claims existed carry only the item reference.
    const legacy = await this.options.storage.listBySource({
      orgId: input.orgId,
      source: { integrationId: 'incidentio', type: 'issue', externalId: issue.id },
    });
    return legacy.some(heldLive);
  }

  async #ingestIssue(
    input: IncidentioRulesIngress,
    issue: IncidentioIssueIngress,
    relatedItem: WorkItemRow | undefined,
  ): Promise<IngressStatus> {
    const ingressId = `incidentio:${issue.id}:${issue.updatedAt}`;
    const actor = { type: 'human' as const, id: input.userId };

    // Closed follow-ups without existing work items should not create new ones.
    const isClosed = issue.stateType === 'completed' || issue.stateType === 'canceled';
    if (isClosed && !relatedItem) {
      return 'missing';
    }

    const event = isClosed ? 'followUpClosed' : 'followUpObserved';
    const boundBoardId = issue.sourceId ? input.intakeBoards?.[issue.sourceId] : undefined;
    const boundBoard = boundBoardId ? this.options.boards.get(boundBoardId) : undefined;
    const context: FactoryIncidentioRuleContext = {
      tenant: { orgId: input.orgId, projectId: input.factoryProjectId },
      actor,
      ingress: { type: 'incidentio', id: ingressId },
      cause: `incidentio.${event}`,
      causalChain: [],
      configVersion: this.options.configVersion,
      ...(relatedItem
        ? {
            item: {
              id: relatedItem.id,
              source: 'incidentio-follow-up',
              sourceKey: relatedItem.externalSource?.externalId ?? null,
              parentWorkItemId: relatedItem.parentWorkItemId,
              title: relatedItem.title,
              url: relatedItem.externalSource?.url ?? null,
              stages: relatedItem.stages,
              acceptedAt: relatedItem.acceptedAt,
              metadata: relatedItem.metadata,
            },
            board: boardForWorkItem(relatedItem),
            itemRevision: relatedItem.revision,
          }
        : {}),
      ...(boundBoard ? { intake: { board: boundBoard.id, initialPhase: boundBoard.initialPhase } } : {}),
      event,
      issue,
    };

    const rule = this.options.incidentioRules[context.event];
    let decision: FactoryRuleDecision | void;
    let decisions: Record<string, unknown>[] = [];
    let outcome: { status: 'accepted' | 'rejected'; code?: string; reason?: string } = { status: 'accepted' };
    try {
      decision = rule ? await withRuleTimeout(Promise.resolve(rule(Object.freeze(context)))) : undefined;
      if (decision?.type === 'reject') {
        outcome = { status: 'rejected', code: decision.code, reason: decision.reason };
      } else if (decision) {
        decisions = validateFactoryRuleDecisions([decision]).map(entry => {
          assertFactoryDecisionTarget(
            entry,
            this.options.boards,
            relatedItem ? boardForWorkItem(relatedItem) : undefined,
          );
          return { ...entry };
        });
      }
    } catch (error) {
      const timedOut = error instanceof Error && error.message === 'FACTORY_RULE_TIMEOUT';
      outcome = {
        status: 'rejected',
        code: timedOut ? 'timeout' : 'rule_error',
        reason: timedOut
          ? 'Factory rule evaluation timed out.'
          : error instanceof Error
            ? error.message.slice(0, 2_000)
            : 'Factory incident.io rule failed.',
      };
    }

    const committed = await this.options.storage.commitRuleEvaluation({
      orgId: input.orgId,
      factoryProjectId: input.factoryProjectId,
      workItemId: relatedItem?.id ?? null,
      ingress: { identity: ingressId, triggerType: `incidentio.${event}` },
      configVersion: this.options.configVersion,
      expectedRevision: relatedItem?.revision ?? null,
      actor,
      outcome,
      decisions,
      causalChain: [],
      now: new Date(),
    });
    return committed.status;
  }
}

export function attachIncidentioRules(
  incidentio: { readonly rules: IncidentioEventRules },
  context: IntegrationContext,
): ((input: IncidentioRulesIngress) => Promise<unknown>) | undefined {
  if (!context.runtime) return undefined;
  const rules = new IncidentioRules({
    projects: context.storage.projects,
    storage: context.runtime.workItems,
    configVersion: context.runtime.configVersion,
    boards: context.runtime.boards,
    incidentioRules: incidentio.rules,
  });
  return input => rules.ingest(input);
}
