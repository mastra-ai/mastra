import type { IntegrationContext } from '../base.js';
import type { IssueReconciler, IssueReconcileSummary } from '../issue-reconciler.js';
import { attachGitLabDiscovery } from './discovery.js';
import type { GitLabIntegrationBase } from './integration.js';
import { attachGitLabIssueReconciler } from './issue-reconciler.js';
import { attachGitLabMergeRequestReconciler } from './merge-request-reconciler.js';

export function attachGitLabReconciler(
  gitlab: GitLabIntegrationBase,
  context: IntegrationContext,
): IssueReconciler | undefined {
  const issues = attachGitLabIssueReconciler(gitlab, context);
  const mergeRequests = attachGitLabMergeRequestReconciler(gitlab, context);
  const discovery = attachGitLabDiscovery(gitlab, context);
  if (!issues && !mergeRequests && !discovery) return undefined;
  return async () => {
    // Existing cards settle first, so discovery never races their close and refresh writes.
    const results = [...(await Promise.all([issues?.(), mergeRequests?.()])), await discovery?.()];
    return results
      .filter((result): result is IssueReconcileSummary => result !== undefined)
      .reduce(
        (summary, result) => ({
          projects: Math.max(summary.projects, result.projects),
          checked: summary.checked + result.checked,
          updated: summary.updated + result.updated,
          closed: summary.closed + result.closed,
          missing: summary.missing + result.missing,
          failed: summary.failed + result.failed,
          errors: [...summary.errors, ...result.errors],
        }),
        { projects: 0, checked: 0, updated: 0, closed: 0, missing: 0, failed: 0, errors: [] },
      );
  };
}
