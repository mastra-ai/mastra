import type { LinearIssueIngress } from '../../factory-integration.js';
import type { FactoryProjectsStorage } from '../../storage/domains/projects/base.js';
import type { WorkItemRow, WorkItemsStorage } from '../../storage/domains/work-items/base.js';
import { resolveFactoryLinearRule } from './resolve.js';
import type { FactoryLinearRuleContext, FactoryRuleDecision, FactoryRules } from './types.js';
import { validateFactoryRuleDecisions } from './validation.js';

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

export interface FactoryLinearIssueServiceOptions {
  projects: Pick<FactoryProjectsStorage, 'get'>;
  storage: WorkItemsStorage;
  rules: FactoryRules;
}

export interface FactoryLinearIssueIngress {
  orgId: string;
  userId: string;
  factoryProjectId: string;
  issues: LinearIssueIngress[];
}

type IngressStatus = 'committed' | 'replayed' | 'missing';

export class FactoryLinearIssueService {
  constructor(private readonly options: FactoryLinearIssueServiceOptions) {}

  async ingest(input: FactoryLinearIssueIngress): Promise<{ status: IngressStatus; ingested: number }> {
    const project = await this.options.projects.get({ orgId: input.orgId, id: input.factoryProjectId });
    if (!project) return { status: 'missing', ingested: 0 };

    const items = await this.options.storage.list({ orgId: input.orgId, factoryProjectId: input.factoryProjectId });
    const itemsBySourceKey = new Map(items.map(item => [item.externalSource?.externalId, item]));
    const statuses: IngressStatus[] = [];
    for (const issue of input.issues) {
      statuses.push(await this.#ingestIssue(input, issue, itemsBySourceKey.get(`linear:${issue.identifier}`)));
    }
    if (statuses.some(status => status === 'committed')) return { status: 'committed', ingested: statuses.length };
    if (statuses.some(status => status === 'replayed')) return { status: 'replayed', ingested: statuses.length };
    return { status: 'missing', ingested: statuses.length };
  }

  async #ingestIssue(
    input: FactoryLinearIssueIngress,
    issue: LinearIssueIngress,
    relatedItem: WorkItemRow | undefined,
  ): Promise<IngressStatus> {
    const ingressId = `linear:${issue.id}:${issue.updatedAt}`;
    const actor = { type: 'human' as const, id: input.userId };
    const context: FactoryLinearRuleContext = {
      tenant: { orgId: input.orgId, projectId: input.factoryProjectId },
      actor,
      ingress: { type: 'linear', id: ingressId },
      cause: 'linear.issueObserved',
      causalChain: [],
      ruleSetVersion: this.options.rules.version,
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
            },
            board: 'work' as const,
            itemRevision: relatedItem.revision,
          }
        : {}),
      event: 'issueObserved',
      issue,
    };

    const rule = resolveFactoryLinearRule(this.options.rules, context.event);
    let decision: FactoryRuleDecision | void;
    let decisions: Record<string, unknown>[] = [];
    let outcome: { status: 'accepted' | 'rejected'; code?: string; reason?: string } = { status: 'accepted' };
    try {
      decision = rule ? await withRuleTimeout(Promise.resolve(rule(Object.freeze(context)))) : undefined;
      if (decision?.type === 'reject') {
        outcome = { status: 'rejected', code: decision.code, reason: decision.reason };
      } else if (decision) {
        decisions = validateFactoryRuleDecisions([decision]).map(entry => ({ ...entry }));
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
      ruleSetVersion: this.options.rules.version,
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
