import type { IntegrationContext } from '../base.js';
import type { IssueReconciler, IssueReconcileSummary } from '../issue-reconciler.js';
import type { GitLabIntegrationBase } from './integration.js';
import {
  ingestListedEvents,
  LINKED_BACKLOG_MAX_PAGES,
  listedIssueEvent,
  listedMergeRequestEvents,
  positiveId,
  routedGitLabSourceIds,
} from './routes.js';
import { attachGitLabRules } from './rules.js';

/**
 * First observation of the merge requests and issues GitLab sent no event
 * for. It runs inside the leased reconcile sweep, so a card appears whether or
 * not anyone has the board open, and the list routes stay pure reads.
 */
export function attachGitLabDiscovery(
  gitlab: Pick<
    GitLabIntegrationBase,
    | 'versionControl'
    | 'intake'
    | 'getLinkedRepository'
    | 'rules'
    | 'getProjectMemberAccessLevel'
    | 'getWorkItemAuthorUsername'
    | 'resolveActiveConnectionForHost'
  >,
  context: IntegrationContext,
): IssueReconciler | undefined {
  const ingest = attachGitLabRules(gitlab, context);
  if (!ingest) return undefined;
  const { projects, sourceControl, intake } = context.storage;

  return async () => {
    const summary: IssueReconcileSummary = {
      projects: 0,
      checked: 0,
      updated: 0,
      closed: 0,
      missing: 0,
      failed: 0,
      errors: [],
    };
    for (const project of await projects.listAll()) {
      summary.projects += 1;
      const scope = { orgId: project.orgId, factoryProjectId: project.id };
      const failed = (error: unknown) => {
        summary.failed += 1;
        summary.errors.push({ projectId: project.id, error: error instanceof Error ? error.message : String(error) });
      };
      // One unreachable repository or source must not hide the others.
      const each = async <T>(list: () => Promise<T[]>, discover: (entry: T) => Promise<void>) => {
        for (const entry of await list().catch(error => (failed(error), []))) await discover(entry).catch(failed);
      };

      await each(
        () => sourceControl.projectRepositories.listByProject(scope),
        async link => {
          const linked = await gitlab.getLinkedRepository({ ...scope, projectRepositoryId: link.id });
          const projectId = linked && positiveId(linked.repository.externalId);
          if (!linked || !projectId) return;
          const target = await gitlab.versionControl.getRepositoryTarget({
            orgId: project.orgId,
            repositoryId: linked.repository.id,
          });
          for (let page = 1; page <= LINKED_BACKLOG_MAX_PAGES; page += 1) {
            const result = await gitlab.versionControl.listPullRequests({
              ...target,
              includeDrafts: false,
              cursor: String(page),
            });
            const events = result.pullRequests.flatMap(pr =>
              listedMergeRequestEvents({ host: linked.host, projectId, projectPath: linked.repository.slug }, pr),
            );
            (await ingestListedEvents(events, ingest)).forEach(failed);
            if (result.nextCursor === null) break;
          }
        },
      );

      await each(
        async () => (await routedGitLabSourceIds(intake, scope)) ?? [],
        async sourceId => {
          let cursor: string | undefined;
          for (let page = 1; page <= LINKED_BACKLOG_MAX_PAGES; page += 1) {
            const result = await gitlab.intake.listIssues({
              // GitLab resolves the credential from the source id; no caller identity is read.
              connection: { type: 'oauth', accessToken: 'gitlab-sweep' },
              sourceIds: [sourceId],
              cursor,
            });
            (await ingestListedEvents(result.issues.map(listedIssueEvent), ingest)).forEach(failed);
            if (result.nextCursor === null) break;
            cursor = result.nextCursor;
          }
        },
      );
    }
    return summary;
  };
}
