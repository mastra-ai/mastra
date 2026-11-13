import { workItemPhaseSemantics } from '../../boards/index.js';
import { toBoardSource } from '../../boards/project-boards.js';
import type { IntegrationContext } from '../base.js';
import { createIssueReconciler } from '../issue-reconciler.js';
import type { IssueReconcileSummary } from '../issue-reconciler.js';
import { createLinearIntakeDiscovery, issueToIngress } from './intake-discovery.js';
import type { LinearIntegration } from './integration.js';
import { LinearRules } from './rules.js';

export type LinearIssueReconcileSummary = IssueReconcileSummary & {
  /** Active issues on bound sources replayed through the Linear rules (first sight creates the card). */
  observed: number;
};

export type LinearIssueReconciler = () => Promise<LinearIssueReconcileSummary>;

/**
 * One Linear sweep: refresh carded issues (metadata, closes), then list every
 * project's bound sources so issues nobody has carded yet get their card.
 * Linear sends Factory no webhooks, so this is the only first-sight path.
 */
export function attachLinearIssueReconciler(
  linear: Pick<LinearIntegration, 'intake' | 'rules' | 'loadConnection' | 'getFreshAccessToken'>,
  context: Pick<IntegrationContext, 'runtime'> & {
    storage: Pick<IntegrationContext['storage'], 'projects' | 'intake'>;
  },
): LinearIssueReconciler | undefined {
  if (!context.runtime || !linear.intake.resolveIntakeDispatch) return undefined;
  const boards = context.runtime.boards;

  const rules = new LinearRules({
    projects: context.storage.projects,
    storage: context.runtime.workItems,
    configVersion: context.runtime.configVersion,
    boards,
    linearRules: linear.rules,
  });

  const reconcile = createIssueReconciler({
    integrationId: 'linear',
    intake: linear.intake,
    projects: context.storage.projects,
    storage: context.runtime.workItems,
    isTerminal: item => workItemPhaseSemantics(toBoardSource(boards).forProject(item), item)?.kind === 'terminal',
    issueId: item => {
      const issueId = item.workItem.metadata?.linearIssueId;
      return typeof issueId === 'string' && issueId.length > 0 ? issueId : undefined;
    },
    metadata: (_item, issue) => ({
      linearIssueId: issue.id,
      // Persist explicit removal too; omitting the key would retain stale membership.
      linearProjectId: issue.projectId ?? null,
      identifier: issue.identifier,
      linearState: issue.state,
      linearStateType: issue.stateType,
      linearPriority: issue.priority,
      linearAssignee: issue.assignee,
      linearCreator: issue.author,
      linearTeam: issue.source,
      assignee: issue.assignee,
      creator: issue.author,
      author: issue.author,
      labels: issue.labels ?? [],
    }),
    onClosed: async (item, issue, project) => {
      await rules.ingest({
        orgId: project.orgId,
        userId: 'factory-rule-dispatcher',
        factoryProjectId: project.id,
        issues: [issueToIngress(issue)],
      });
    },
  });

  const discover = createLinearIntakeDiscovery({
    linear,
    intake: context.storage.intake,
    projects: context.storage.projects,
    rules,
  });

  return async () => {
    const reconciled = await reconcile();
    const discovered = await discover();
    return {
      ...reconciled,
      observed: discovered.observed,
      failed: reconciled.failed + discovered.failed,
      errors: [...reconciled.errors, ...discovered.errors],
    };
  };
}
