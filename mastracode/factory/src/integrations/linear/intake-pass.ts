import type { IntakeIssue } from '../../capabilities/intake.js';
import type { IntakeStorage } from '../../storage/domains/intake/base.js';
import type { FactoryProjectsStorage } from '../../storage/domains/projects/base.js';
import type { IntegrationContext } from '../base.js';
import { boundIntakeSources, createIntakePass } from '../intake-pass.js';
import type { CandidateStore, IntakePass, IntakePassStatusStore, IntakeRecord } from '../intake-pass.js';
import type { LinearEventRules } from './default-rules.js';
import type { LinearIntegration } from './integration.js';
import { attachLinearRules } from './rules.js';
import type { LinearIssueIngress, LinearRulesIngress } from './rules.js';

export function linearIssueIngress(issue: IntakeIssue): LinearIssueIngress {
  return {
    id: issue.id,
    identifier: issue.identifier,
    title: issue.title,
    url: issue.url,
    state: issue.state ?? '',
    stateType: issue.stateType ?? '',
    priorityLabel: issue.priority ?? '',
    assignee: issue.assignee ?? null,
    creator: issue.author ?? null,
    team: issue.source ?? null,
    labels: [...(issue.labels ?? [])],
    sourceId: issue.sourceId,
    projectId: issue.projectId,
    createdAt: issue.createdAt,
    updatedAt: issue.updatedAt,
  };
}

/** The issue as Intake offers it: the facts its card would carry, so filing changes none of them. */
export function linearIntakeRecord(issue: IntakeIssue): IntakeRecord {
  const created = new Date(issue.createdAt);
  return {
    source: { integrationId: 'linear', type: 'issue', externalId: `linear:${issue.identifier}`, url: issue.url },
    title: issue.title,
    metadata: {
      linearIssueId: issue.id,
      ...(issue.projectId ? { linearProjectId: issue.projectId } : {}),
      identifier: issue.identifier,
      sourceCreatedAt: issue.createdAt,
      state: issue.state,
      linearState: issue.state,
      linearStateType: issue.stateType,
      linearPriority: issue.priority,
      linearAssignee: issue.assignee,
      linearCreator: issue.author,
      linearTeam: issue.source,
      labels: [...(issue.labels ?? [])],
      assignee: issue.assignee,
      creator: issue.author,
      ...(issue.author ? { author: issue.author } : {}),
    },
    createdAt: Number.isNaN(created.getTime()) ? null : created,
  };
}

export interface LinearIntakePassOptions {
  linear: Pick<LinearIntegration, 'intake' | 'loadConnection' | 'getFreshAccessToken'>;
  intake: Pick<IntakeStorage, 'ensureReady' | 'getConfig' | 'listBindings'>;
  projects: Pick<FactoryProjectsStorage, 'listAll'>;
  storage: CandidateStore;
  status: IntakePassStatusStore;
  ingest(input: LinearRulesIngress): Promise<unknown>;
}

/**
 * Keeps the Linear candidates of every project. Linear sends no event for an issue with no card,
 * so this pass is where a new issue is first seen.
 */
export function createLinearIntakePass(options: LinearIntakePassOptions): IntakePass {
  const { linear } = options;
  return createIntakePass<IntakeIssue>({
    integrationId: 'linear',
    kind: 'issue',
    projects: options.projects,
    storage: options.storage,
    status: options.status,
    importsAtBind: true,
    open: async orgId => {
      const bound = await boundIntakeSources(options.intake, orgId, 'linear');
      if (bound.selectedIds.length === 0) return null;
      const connection = await linear.loadConnection(orgId);
      if (!connection) return null;
      let accessToken: string | undefined;
      return {
        sources: bound.forProject,
        list: async (_factoryProjectId, sourceIds, cursor) => {
          accessToken ??= await linear.getFreshAccessToken(connection);
          const page = await linear.intake.listIssues({
            connection: { type: 'oauth', accessToken },
            sourceIds,
            // Precedence (project beats team) is resolved against the whole selection.
            attributionSourceIds: bound.selectedIds,
            ...(cursor ? { cursor } : {}),
          });
          return {
            items: page.issues.filter(issue => issue.sourceId != null && sourceIds.includes(issue.sourceId)),
            nextCursor: page.nextCursor,
          };
        },
      };
    },
    record: linearIntakeRecord,
    sourceId: issue => issue.sourceId,
    // A card filed before Linear renamed the identifier is still the issue's card.
    itemKeys: issue => [`id:${issue.id}`],
    cardKeys: card => {
      const issueId = card.workItem.metadata?.linearIssueId;
      return typeof issueId === 'string' ? [`id:${issueId}`] : [];
    },
    offer: ({ orgId, factoryProjectId }, issues) =>
      options.ingest({
        orgId,
        userId: 'factory-rule-dispatcher',
        factoryProjectId,
        issues: issues.map(linearIssueIngress),
      }),
  });
}

export function attachLinearIntakePass(
  linear: LinearIntakePassOptions['linear'] & { readonly rules: LinearEventRules },
  context: IntegrationContext,
): IntakePass | undefined {
  const ingest = attachLinearRules(linear, context);
  if (!context.runtime || !ingest) return undefined;
  return createLinearIntakePass({
    linear,
    intake: context.storage.intake,
    projects: context.storage.projects,
    storage: context.runtime.workItems,
    status: context.storage.generic.settings,
    ingest,
  });
}
