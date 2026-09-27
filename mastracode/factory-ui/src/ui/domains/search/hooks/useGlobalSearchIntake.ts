import { useProjectIssuesQuery, useProjectPullRequestsQuery } from '../../../../hooks/useFactoryData';
import { useGitLabIssuesQuery, useGitLabMergeRequestsQuery } from '../../../../hooks/useGitLabData';
import {
  gitlabCandidate,
  gitlabMergeRequestCandidate,
  issueCandidate,
  pullRequestCandidate,
} from '../../factory/boardCandidates';
import type { BoardCandidate } from '../../factory/boardCandidates';

/**
 * Live intake feeds: a card is persisted only once somebody acts on a candidate, so a PR/MR opened
 * minutes ago is searchable nowhere else. Use the linked repository's provider and the same query
 * keys as its board Intake column.
 */
export function useGlobalSearchIntake(
  factoryProjectId: string,
  projectRepositoryId: string | undefined,
  provider: string | undefined,
): {
  candidates: Array<{ candidate: BoardCandidate; updatedAt: string }>;
  pending: boolean;
  failed: boolean;
  retry: () => void;
} {
  const gitlab = provider === 'gitlab';
  const pullRequests = useProjectPullRequestsQuery(!gitlab ? projectRepositoryId : undefined);
  // Unlabeled feed already carries auto-triaged issues — board's labelled query only pins them to Triage
  const issues = useProjectIssuesQuery(!gitlab ? projectRepositoryId : undefined);
  const mergeRequests = useGitLabMergeRequestsQuery(
    gitlab ? factoryProjectId : undefined,
    gitlab ? projectRepositoryId : undefined,
  );
  const gitlabIssues = useGitLabIssuesQuery(gitlab ? factoryProjectId : undefined, gitlab ? 'work' : undefined);
  const queries = gitlab ? [mergeRequests, gitlabIssues] : [pullRequests, issues];

  return {
    candidates: gitlab
      ? [
          ...(gitlabIssues.data ?? []).map(issue => ({
            candidate: gitlabCandidate(issue),
            updatedAt: issue.updatedAt,
          })),
          ...(mergeRequests.data ?? []).map(pr => ({
            candidate: gitlabMergeRequestCandidate(pr),
            updatedAt: pr.updatedAt,
          })),
        ]
      : [
          ...(issues.data ?? []).map(issue => ({ candidate: issueCandidate(issue), updatedAt: issue.updatedAt })),
          ...(pullRequests.data ?? []).map(pr => ({ candidate: pullRequestCandidate(pr), updatedAt: pr.updatedAt })),
        ],
    pending: queries.some(query => query.isLoading),
    failed: queries.some(query => query.isError),
    retry: () => {
      void Promise.all(queries.filter(query => query.isError).map(query => query.refetch()));
    },
  };
}
