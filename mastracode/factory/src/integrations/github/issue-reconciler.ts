import type { IntegrationContext } from '../base.js';
import { createIssueReconciler } from '../issue-reconciler.js';
import type { IssueReconciler } from '../issue-reconciler.js';
import type { GithubIntegration } from './integration.js';

export type GithubIssueReconciler = IssueReconciler;

export function attachGithubIssueReconciler(
  github: Pick<GithubIntegration, 'intake'>,
  context: IntegrationContext,
): GithubIssueReconciler | undefined {
  if (!context.rules || !github.intake.resolveIntakeDispatch) return undefined;
  return createIssueReconciler({
    integrationId: 'github',
    intake: github.intake,
    projects: context.storage.projects,
    storage: context.rules.workItems,
    externalSource: item => {
      const repositoryId = item.metadata?.githubRepositoryId;
      const issueNumber = item.metadata?.githubIssueNumber;
      return typeof repositoryId === 'number' && typeof issueNumber === 'number'
        ? { type: 'issue', externalId: `${repositoryId}:${issueNumber}` }
        : item.externalSource!;
    },
    issueId: item => {
      const number = item.metadata?.githubIssueNumber;
      return typeof number === 'number' && Number.isSafeInteger(number) && number > 0 ? String(number) : undefined;
    },
    metadata: (item, issue) => ({
      githubRepositoryId: item.metadata?.githubRepositoryId,
      githubIssueNumber: Number(issue.id),
      state: issue.state,
      author: issue.author,
      assignees: issue.assignees ?? (issue.assignee ? [issue.assignee] : []),
    }),
  });
}
