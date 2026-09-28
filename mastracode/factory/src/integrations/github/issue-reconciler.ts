import { workItemPhaseSemantics } from '../../boards/index.js';
import type { IntegrationContext } from '../base.js';
import {
  githubRulesOptions,
  reconcilableIssueNumber,
  reconciledIssueClosedEvent,
  reconciledIssueOpenedEvent,
  reconciledIssueRelabeledEvent,
  RECONCILE_ERROR_SAMPLE_LIMIT,
  sameStrings,
  sweepTrustLookup,
  GithubRules,
} from './rules.js';
import type {
  GithubIssueFetcher,
  GithubOpenIssueLister,
  GithubRulesIntegration,
  GithubRulesOptions,
  ReconcileRepository,
} from './rules.js';

export interface GithubIssueReconcileSummary {
  /** Repositories included in the sweep. */
  repositories: number;
  /** Issue cards whose live state was fetched. */
  checked: number;
  /** Open issues with metadata patches. */
  updated: number;
  /** Closed issues replayed through the rules ingress. */
  closed: number;
  /** Open issues whose changed labels were replayed through the rules ingress. */
  relabeled: number;
  /** Open issues with no Work card replayed as `opened` through the rules ingress. */
  created: number;
  /** Errors encountered during the sweep. */
  failed: number;
  /** Error samples with context. */
  errors: Array<{ repository: string; issueNumber?: number; error: string }>;
}

export type GithubIssueReconciler = (repositories: ReconcileRepository[]) => Promise<GithubIssueReconcileSummary>;

export function createGithubIssueReconciler(
  options: GithubRulesOptions,
  fetchIssue: GithubIssueFetcher,
  listOpenIssues?: GithubOpenIssueLister,
): GithubIssueReconciler {
  const rules = new GithubRules(options);
  return async repositories => {
    const summary: GithubIssueReconcileSummary = {
      repositories: 0,
      checked: 0,
      updated: 0,
      closed: 0,
      relabeled: 0,
      created: 0,
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
        // Every issue with any card, terminal included: a finished card must
        // not be re-minted by missed-open discovery.
        const carded = new Set<number>();

        for (const project of projects) {
          const items = await options.storage.list({
            orgId: project.orgId,
            factoryProjectId: project.factoryProjectId,
          });
          for (const item of items) {
            const issueNumber = reconcilableIssueNumber(item, repository);
            if (!issueNumber) continue;
            carded.add(issueNumber);
            if (workItemPhaseSemantics(options.boards, item)?.kind === 'terminal') continue;
            let list = itemsByNumber.get(issueNumber);
            if (!list) {
              list = [];
              itemsByNumber.set(issueNumber, list);
            }
            list.push(item);
          }
        }

        // Missed-open discovery: an `opened` delivery that never reached the
        // ingress leaves no card for the sweeps above to repair. Only issues
        // filed after the repository was linked are replayed, so linking a
        // repository never backfills its existing backlog.
        if (listOpenIssues) {
          const linkedAt = Math.min(...projects.map(project => project.projectRepository.createdAt.getTime()));
          const openIssues = await listOpenIssues({
            installationId: repository.installationId,
            repository: repository.fullName,
          });
          for (const issue of openIssues) {
            if (carded.has(issue.number)) continue;
            const createdAt = issue.createdAt ? Date.parse(issue.createdAt) : Number.NaN;
            if (!Number.isFinite(createdAt) || createdAt < linkedAt) continue;
            try {
              const result = await rules.ingest(reconciledIssueOpenedEvent(repository, issue.number, issue));
              if (result.status === 'committed') summary.created += 1;
            } catch (error) {
              recordFailure(repository, error, issue.number);
            }
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

            // Label drift decides where the card belongs, and the rule that owns
            // that decision has to run again — mirrored from the `labeled` /
            // `unlabeled` webhook, replayed here so a label Factory never saw a
            // delivery for still re-places the card. Replayed before the
            // metadata patch, so the ingress sees the drift it acts on.
            if (
              state.labels !== undefined &&
              items.some(
                item => Array.isArray(item.metadata?.labels) && !sameStrings(item.metadata.labels, state.labels),
              )
            ) {
              await rules.ingest(reconciledIssueRelabeledEvent(repository, issueNumber, state));
              summary.relabeled += 1;
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
  listOpenIssues?: GithubOpenIssueLister,
): GithubIssueReconciler | undefined {
  if (!context.runtime) return undefined;
  const options = githubRulesOptions(github, context);
  if (!options) return undefined;
  return createGithubIssueReconciler(options, fetchIssue, listOpenIssues);
}
