import { boardForWorkItem, isTerminalWorkItem } from '../../boards/index.js';
import type { BoardRegistry } from '../../boards/index.js';
import type { FactoryLinearRuleContext, FactoryRuleDecision } from '../../rules/types.js';
import { assertFactoryDecisionTarget, validateFactoryRuleDecisions } from '../../rules/validation.js';
import type { FactoryProjectsStorage } from '../../storage/domains/projects/base.js';
import type { WorkItemRow, WorkItemsStorage } from '../../storage/domains/work-items/base.js';
import type { IntegrationContext } from '../base.js';
import { linearClaimKey } from './claim.js';
import type { LinearEventRules } from './default-rules.js';

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

export interface LinearIssueIngress {
  id: string;
  identifier: string;
  title: string;
  url: string;
  state: string;
  stateType: string;
  priorityLabel: string;
  assignee: string | null;
  /** Display name of the Linear user who created the issue, when available. */
  creator: string | null;
  team: string | null;
  labels: string[];
  createdAt: string;
  updatedAt: string;
  /** Linear source the issue was read from (project or team); resolves the bound board via `intakeBoards`. */
  sourceId?: string | null;
}

export interface LinearRulesOptions {
  projects: Pick<FactoryProjectsStorage, 'get'>;
  storage: WorkItemsStorage;
  configVersion: string;
  boards: BoardRegistry;
  linearRules: LinearEventRules;
}

export interface LinearRulesIngress {
  orgId: string;
  userId: string;
  factoryProjectId: string;
  issues: LinearIssueIngress[];
  /** Board id per bound Linear source id, from the project's intake bindings. */
  intakeBoards?: Readonly<Record<string, string>>;
}

type IngressStatus = 'committed' | 'replayed' | 'missing';

export class LinearRules {
  constructor(private readonly options: LinearRulesOptions) {}

  async ingest(input: LinearRulesIngress): Promise<{ status: IngressStatus; ingested: number }> {
    const project = await this.options.projects.get({ orgId: input.orgId, id: input.factoryProjectId });
    if (!project) return { status: 'missing', ingested: 0 };

    const items = await this.options.storage.list({ orgId: input.orgId, factoryProjectId: input.factoryProjectId });
    const itemsBySourceKey = new Map(items.map(item => [item.externalSource?.externalId, item]));
    const itemsByClaimKey = new Map(items.filter(item => item.claimKey).map(item => [item.claimKey, item]));
    const statuses: IngressStatus[] = [];
    for (const issue of input.issues) {
      // The stable issue id finds the card even after Linear renamed the
      // identifier; the identifier covers cards filed before claims existed.
      const relatedItem =
        itemsByClaimKey.get(linearClaimKey(issue.id)) ?? itemsBySourceKey.get(`linear:${issue.identifier}`);
      // One live card per Linear issue per org. When the winning source for an
      // issue moves to a source routed elsewhere (a project deselected under a
      // selected team, or the reverse), the card that already exists keeps the
      // issue; this Factory must not mint a second one. The store's claim index
      // is the guarantee; this check spares the dispatcher a refused upsert.
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

  async #heldElsewhere(input: LinearRulesIngress, issue: LinearIssueIngress): Promise<boolean> {
    const heldLive = (row: WorkItemRow) =>
      row.factoryProjectId !== input.factoryProjectId && !isTerminalWorkItem(this.options.boards, row);
    const claimant = await this.options.storage.getByClaimKey({
      orgId: input.orgId,
      claimKey: linearClaimKey(issue.id),
    });
    if (claimant && heldLive(claimant)) return true;
    // Cards filed before claims existed carry only the identifier.
    const legacy = await this.options.storage.listBySource({
      orgId: input.orgId,
      source: { integrationId: 'linear', type: 'issue', externalId: `linear:${issue.identifier}` },
    });
    return legacy.some(heldLive);
  }

  async #ingestIssue(
    input: LinearRulesIngress,
    issue: LinearIssueIngress,
    relatedItem: WorkItemRow | undefined,
  ): Promise<IngressStatus> {
    const ingressId = `linear:${issue.id}:${issue.updatedAt}`;
    const actor = { type: 'human' as const, id: input.userId };

    // Closed issues without existing work items should not create new ones.
    const isClosed = issue.stateType === 'completed' || issue.stateType === 'canceled';
    if (isClosed && !relatedItem) {
      return 'missing';
    }

    const event = isClosed ? 'issueClosed' : 'issueObserved';
    const boundBoardId = issue.sourceId ? input.intakeBoards?.[issue.sourceId] : undefined;
    const boundBoard = boundBoardId ? this.options.boards.get(boundBoardId) : undefined;
    const context: FactoryLinearRuleContext = {
      tenant: { orgId: input.orgId, projectId: input.factoryProjectId },
      actor,
      ingress: { type: 'linear', id: ingressId },
      cause: `linear.${event}`,
      causalChain: [],
      configVersion: this.options.configVersion,
      ...(relatedItem
        ? {
            item: {
              id: relatedItem.id,
              source: 'linear-issue',
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

    const rule = this.options.linearRules[context.event];
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
            : 'Factory Linear rule failed.',
      };
    }

    const committed = await this.options.storage.commitRuleEvaluation({
      orgId: input.orgId,
      factoryProjectId: input.factoryProjectId,
      workItemId: relatedItem?.id ?? null,
      ingress: { identity: ingressId, triggerType: 'linear.issueObserved' },
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

export function attachLinearRules(
  linear: { readonly rules: LinearEventRules },
  context: IntegrationContext,
): ((input: LinearRulesIngress) => Promise<unknown>) | undefined {
  if (!context.runtime) return undefined;
  const rules = new LinearRules({
    projects: context.storage.projects,
    storage: context.runtime.workItems,
    configVersion: context.runtime.configVersion,
    boards: context.runtime.boards,
    linearRules: linear.rules,
  });
  return input => rules.ingest(input);
}
