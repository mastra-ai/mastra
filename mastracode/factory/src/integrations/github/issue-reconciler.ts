import type { IntegrationContext } from '../base.js';
import {
  githubRulesOptions,
  reconcilableIssueNumber,
  reconciledIssueClosedEvent,
  RECONCILE_ERROR_SAMPLE_LIMIT,
  sameStrings,
  sweepTrustLookup,
  GithubRules,
} from './rules.js';
import type { GithubIssueFetcher, GithubRulesIntegration, GithubRulesOptions, ReconcileRepository } from './rules.js';

export interface GithubIssueReconcileSummary {
  /** Repositories included in the sweep. */
  repositories: number;
  /** Issue cards whose live state was fetched. */
  checked: number;
  /** Open issues with metadata patches. */
  updated: number;
  /** Closed issues replayed through the rules ingress. */
  closed: number;
  /** Errors encountered during the sweep. */
  failed: number;
  /** Error samples with context. */
  errors: Array<{ repository: string; issueNumber?: number; error: string }>;
}

export type GithubIssueReconciler = (repositories: ReconcileRepository[]) => Promise<GithubIssueReconcileSummary>;

export function createGithubIssueReconciler(
  options: GithubRulesOptions,
  fetchIssue: GithubIssueFetcher,
): GithubIssueReconciler {
  const rules = new GithubRules(options);
  return async repositories => {
    const summary: GithubIssueReconcileSummary = {
      repositories: 0,
      checked: 0,
      updated: 0,
      closed: 0,
      failed: 0,
      errors: [],
    };
    const recordFailure = (repository: ReconcileRepository, error: unknown, issueNumber?: number) => {
      summary.failed += 1;
      if (summary.errors.length < RECONCILE_ERROR_SAMPLE_LIMIT) {
        summary.errors.push({
          repository: repository.fullName,
          ...(issueNumber === undefined ? {} : { issueNumber }),
          error: error instanceof Error ? error.message : String(error),
        });
      }
    };

    for (const repository of repositories) {
      summary.repositories += 1;
      const authorTrust = sweepTrustLookup(options.github, repository);

      try {
        const projects = await options.sourceControl.projectRepositories.listByExternalRepository({
          installationExternalId: String(repository.installationId),
          repositoryExternalId: String(repository.id),
        });
        if (projects.length === 0) continue;

        // Collect issue cards: number -> items (skip terminal stages)
        const itemsByNumber = new Map<number, import('../../storage/domains/work-items/base.js').WorkItemRow[]>();

        for (const project of projects) {
          const items = await options.storage.list({
            orgId: project.orgId,
            factoryProjectId: project.factoryProjectId,
          });
          for (const item of items) {
            const issueNumber = reconcilableIssueNumber(item, repository);
            if (!issueNumber) continue;
            const stage = item.stages[0];
            if (stage === 'done' || stage === 'canceled') continue; // terminal, skip
            let list = itemsByNumber.get(issueNumber);
            if (!list) {
              list = [];
              itemsByNumber.set(issueNumber, list);
            }
            list.push(item);
          }
        }

        // Fetch and reconcile each unique issue
        for (const [issueNumber, items] of itemsByNumber) {
          try {
            const state = await fetchIssue({
              installationId: repository.installationId,
              repository: repository.fullName,
              number: issueNumber,
            });
            if (!state) continue; // missing or PR-backed
            summary.checked += 1;

            // Close detection: replay through rules ingress
            if (state.state === 'closed') {
              await rules.ingest(reconciledIssueClosedEvent(repository, issueNumber, state));
              summary.closed += 1;
              continue; // card transitions, skip metadata patch
            }

            // Metadata sync for open issues
            const desiredMetadata = {
              githubRepositoryId: repository.id,
              githubIssueNumber: issueNumber,
              state: 'open' as const,
              ...(state.author === undefined ? {} : { author: state.author }),
              ...(state.assignees === undefined ? {} : { assignees: state.assignees }),
              ...(state.labels === undefined ? {} : { labels: state.labels }),
            };
            // Re-stamped on every sweep so revoked write access reads untrusted
            // within one cycle; a failed lookup keeps the last stamp and retries.
            let authorTrusted: boolean | undefined;
            if (state.author !== undefined) {
              try {
                authorTrusted = await authorTrust(state.author);
              } catch (error) {
                recordFailure(repository, error, issueNumber);
              }
            }

            for (const item of items) {
              const current = item.metadata ?? {};
              const trustStale = authorTrusted !== undefined && current.authorTrusted !== authorTrusted;
              const metadataChanged =
                trustStale ||
                current.githubRepositoryId !== desiredMetadata.githubRepositoryId ||
                current.githubIssueNumber !== desiredMetadata.githubIssueNumber ||
                current.state !== desiredMetadata.state ||
                (state.author !== undefined && current.author !== state.author) ||
                (state.assignees !== undefined && !sameStrings(current.assignees, state.assignees)) ||
                (state.labels !== undefined && !sameStrings(current.labels, state.labels));

              if (!metadataChanged) continue;

              await options.storage.update({
                orgId: item.orgId,
                id: item.id,
                userId: 'factory-rule-dispatcher',
                patch: { metadata: { ...current, ...desiredMetadata, ...(trustStale ? { authorTrusted } : {}) } },
              });
              summary.updated += 1;
            }
          } catch (error) {
            recordFailure(repository, error, issueNumber);
          }
        }
      } catch (error) {
        recordFailure(repository, error);
      }
    }

    return summary;
  };
}

export function attachGithubIssueReconciler(
  github: GithubRulesIntegration,
  context: IntegrationContext,
  fetchIssue: GithubIssueFetcher,
): GithubIssueReconciler | undefined {
  if (!context.rules) return undefined;
  const options = githubRulesOptions(github, context);
  if (!options) return undefined;
  return createGithubIssueReconciler(options, fetchIssue);
}