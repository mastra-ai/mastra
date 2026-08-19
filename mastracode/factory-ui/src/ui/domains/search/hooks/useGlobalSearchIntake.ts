import { useProjectIssuesQuery, useProjectPullRequestsQuery } from '../../../../hooks/useFactoryData';

/**
 * Live intake feeds: a card is persisted only once somebody acts on a candidate, so a PR opened
 * minutes ago is searchable nowhere else. Same query keys as the board's Intake column.
 */
export function useGlobalSearchIntake(projectRepositoryId: string | undefined) {
  const pullRequests = useProjectPullRequestsQuery(projectRepositoryId);
  // Unlabeled feed already carries auto-triaged issues — board's labelled query only pins them to Triage
  const issues = useProjectIssuesQuery(projectRepositoryId);
  const queries = [pullRequests, issues];

  return {
    pullRequests: pullRequests.data ?? [],
    issues: issues.data ?? [],
    pending: queries.some(query => query.isLoading),
    failed: queries.some(query => query.isError),
    retry: () => {
      void Promise.all(queries.filter(query => query.isError).map(query => query.refetch()));
    },
  };
}
