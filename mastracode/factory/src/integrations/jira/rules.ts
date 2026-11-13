import { closeReason } from '../../boards/board-events.js';
import type { BoardEventFacts } from '../../boards/board-events.js';
import {
  boardEventHandlers,
  boardForWorkItem,
  eventBoardId,
  rulePhaseField,
  withBoardClosure,
  withIntakeTarget,
} from '../../boards/index.js';
import type { BoardRegistry } from '../../boards/index.js';
import { toBoardSource } from '../../boards/project-boards.js';
import type { ProjectBoardSource } from '../../boards/project-boards.js';
import { deploymentOwnsEvent, routeEventDecision, selectEventRule, withoutRouteEvent } from '../../rules/event-rules.js';
import type { FactoryJiraRuleContext, FactoryRuleDecision } from '../../rules/types.js';
import { assertFactoryDecisionTarget, validateFactoryRuleDecisions } from '../../rules/validation.js';
import type { StoredBoardScope } from '../../storage/domains/boards/base.js';
import type { FactoryProjectsStorage } from '../../storage/domains/projects/base.js';
import type { Card, WorkItemsStorage } from '../../storage/domains/work-items/base.js';
import type { IntegrationContext } from '../base.js';
import { cardIngressId, cardsByExternalId } from '../record-cards.js';
import type { JiraEventRules } from './default-rules.js';

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

const MAX_STALE_RULE_ATTEMPTS = 3;

export interface JiraIssueIngress {
  /** Stable issue reference — direct Jira id or the Platform-encoded issue reference. */
  id: string;
  identifier: string;
  title: string;
  url: string;
  state: string;
  stateType: string;
  priorityLabel: string;
  assignee: string | null;
  /** Display name of the Jira reporter, when available. */
  author: string | null;
  /** Jira project key the issue belongs to, when available. */
  project: string | null;
  /** Jira site host the issue was read from, when available. */
  site: string | null;
  labels: string[];
  createdAt: string;
  updatedAt: string;
  /** Jira source the issue was read from. */
  sourceId?: string | null;
}

export interface JiraRulesOptions {
  projects: Pick<FactoryProjectsStorage, 'get'>;
  storage: WorkItemsStorage;
  configVersion: string;
  /** The code boards, or the per-project source so a project's stored boards run its cards. */
  boards: BoardRegistry | ProjectBoardSource;
  jiraRules: JiraEventRules;
}

export interface JiraRulesIngress {
  orgId: string;
  userId: string;
  factoryProjectId: string;
  issues: JiraIssueIngress[];
}

type IngressStatus = 'committed' | 'replayed' | 'missing';

/**
 * The status change a Jira sync reports: a issue seen for the first time is created, and a
 * completed or canceled one is closed for that reason. Later sightings of an open issue report none.
 */
export function boardEventFor(context: Pick<FactoryJiraRuleContext, 'event' | 'issue' | 'item'>): BoardEventFacts | undefined {
  if (context.event === 'issueClosed') {
    return { type: 'work_item.closed', reason: closeReason(context.issue.stateType === 'canceled') };
  }
  return context.item ? undefined : { type: 'work_item.created' };
}

export class JiraRules {
  constructor(private readonly options: JiraRulesOptions) {}

  /** The project's boards, loaded at the start of {@link ingest}. */
  #boards(scope: StoredBoardScope): BoardRegistry {
    return toBoardSource(this.options.boards).forProject(scope);
  }

  async ingest(input: JiraRulesIngress): Promise<{ status: IngressStatus; ingested: number }> {
    const project = await this.options.projects.get({ orgId: input.orgId, id: input.factoryProjectId });
    if (!project) return { status: 'missing', ingested: 0 };
    await toBoardSource(this.options.boards).load(input);

    // A finished card may still be only in the legacy table; copy it so the issue finds it.
    await this.options.storage.copyLegacyCards({
      orgId: input.orgId,
      factoryProjectId: input.factoryProjectId,
      sources: input.issues.map(issue => ({ integrationId: 'jira', type: 'issue', externalId: issue.id })),
    });
    // The shared list is the cache itself: only the card handed on to rules is cloned.
    const items = await this.options.storage.listShared({ orgId: input.orgId, factoryProjectId: input.factoryProjectId });
    const itemsBySourceKey = cardsByExternalId(items);
    const statuses: IngressStatus[] = [];
    for (const issue of input.issues) {
      // One card per Jira issue per project; other projects may file their own.
      const cards = itemsBySourceKey.get(issue.id) ?? [];
      if (!cards.length) statuses.push(await this.#ingestIssue(input, issue, undefined));
      // Each board's card runs its own rules for the record.
      for (const [index, card] of cards.entries()) {
        statuses.push(await this.#ingestIssue(input, issue, structuredClone(card), 1, index > 0));
      }
    }
    if (statuses.some(status => status === 'committed')) return { status: 'committed', ingested: statuses.length };
    if (statuses.some(status => status === 'replayed')) return { status: 'replayed', ingested: statuses.length };
    return { status: 'missing', ingested: statuses.length };
  }

  async #ingestIssue(
    input: JiraRulesIngress,
    issue: JiraIssueIngress,
    relatedItem: Card | undefined,
    attempt = 1,
    sibling = false,
  ): Promise<IngressStatus> {
    const ingressId = cardIngressId(`jira:${issue.id}:${issue.updatedAt}`, relatedItem, sibling);
    const actor = { type: 'human' as const, id: input.userId };

    // Closed issues without existing work items should not create new ones.
    const isClosed = issue.stateType === 'completed' || issue.stateType === 'canceled';
    if (isClosed && !relatedItem) {
      return 'missing';
    }

    const event = isClosed ? 'issueClosed' : 'issueObserved';
    const context: FactoryJiraRuleContext = {
      tenant: { orgId: input.orgId, projectId: input.factoryProjectId },
      actor,
      ingress: { type: 'jira', id: ingressId },
      cause: `jira.${event}`,
      causalChain: [],
      configVersion: this.options.configVersion,
      ...(relatedItem
        ? {
            item: {
              id: relatedItem.id,
              source: 'jira-issue',
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
            ...withBoardClosure(this.#boards(input), relatedItem),
            ...rulePhaseField(this.#boards(input), relatedItem),
          }
        : {}),
      ...withIntakeTarget(this.#boards(input)),
      event,
      issue,
    };
    const boardEvent = boardEventFor(context);
    if (boardEvent) context.boardEvent = boardEvent;

    const ownedByDeployment = deploymentOwnsEvent(
      this.options.jiraRules,
      boardEventHandlers(this.#boards(input), eventBoardId(context), 'jira'),
      context.event,
    );
    const rule = selectEventRule(
      this.options.jiraRules,
      boardEventHandlers(this.#boards(input), eventBoardId(context), 'jira'),
      context.event,
    );
    let decision: FactoryRuleDecision | void = undefined;
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
            this.#boards(input),
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
            : 'Factory Jira rule failed.',
      };
    }
    if (ownedByDeployment) decisions = decisions.map(withoutRouteEvent);
    if (!decision && !ownedByDeployment && outcome.status === 'accepted') {
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
      ingress: { identity: ingressId, triggerType: 'jira.issueObserved' },
      configVersion: this.options.configVersion,
      expectedRevision: relatedItem?.revision ?? null,
      actor,
      outcome,
      decisions,
      causalChain: [],
      now: new Date(),
    });
    if (committed.status === 'stale') {
      // Nothing was persisted: re-read the item and evaluate again at its fresh revision.
      if (attempt >= MAX_STALE_RULE_ATTEMPTS) {
        throw new Error(`Factory Jira rule evaluation for ${ingressId} kept losing revision races.`);
      }
      const fresh = relatedItem ? await this.options.storage.get({ orgId: input.orgId, id: relatedItem.id }) : null;
      if (relatedItem && !fresh) return 'missing';
      return this.#ingestIssue(input, issue, fresh ?? undefined, attempt + 1, sibling);
    }
    return committed.status;
  }
}

export function attachJiraRules(
  jira: { readonly rules: JiraEventRules },
  context: IntegrationContext,
): ((input: JiraRulesIngress) => Promise<unknown>) | undefined {
  if (!context.runtime) return undefined;
  const rules = new JiraRules({
    projects: context.storage.projects,
    storage: context.runtime.workItems,
    configVersion: context.runtime.configVersion,
    boards: context.runtime.boards,
    jiraRules: jira.rules,
  });
  return input => rules.ingest(input);
}
