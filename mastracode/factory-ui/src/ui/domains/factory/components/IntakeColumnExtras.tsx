import { Button } from '@mastra/playground-ui/components/Button';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useEffect } from 'react';

import { useApiConfig } from '../../../../api/config';
import type { useProjectIssuesQuery, useProjectPullRequestsQuery } from '../../../../hooks/useFactoryData';
import { useGithubStatusQuery } from '../../../../hooks/useGithubStatus';
import type { useLinearIssuesQuery } from '../../../../hooks/useLinearData';
import { isGithubInstallationBrokenError, manageGithubConnection } from '../../workspaces/services/github';
import type { IntakeSource } from '../boardCandidates';
import { connectLinear, isLinearReauthError } from '../services/linear';
import { LoadMoreSentinel } from './LoadMoreSentinel';

/**
 * Intake column tail for the ACTIVE candidate feed: loading state, Linear
 * reauth notice, and pagination. Only one feed is browsed at a time, so only
 * its states render.
 */
export function IntakeColumnExtras({
  source,
  issues,
  pulls,
  linearIssues,
  accountLogin,
}: {
  source?: IntakeSource;
  issues: ReturnType<typeof useProjectIssuesQuery>;
  pulls: ReturnType<typeof useProjectPullRequestsQuery>;
  linearIssues: ReturnType<typeof useLinearIssuesQuery>;
  accountLogin?: string;
}) {
  const { baseUrl } = useApiConfig();
  const githubSourceActive = source === 'github' || source === 'github-prs';
  const githubStatus = useGithubStatusQuery(githubSourceActive);
  useEffect(() => {
    if (source === 'github-prs' && pulls.isError) void githubStatus.refetch();
  }, [githubStatus.refetch, pulls.error, pulls.isError, source]);
  if (source === undefined) return null;
  const feed = source === 'github' ? issues : source === 'github-prs' ? pulls : linearIssues;
  const statusHasMatchingBrokenInstallation = githubStatus.data?.brokenInstallations?.some(
    installation => installation.accountLogin?.toLowerCase() === accountLogin?.toLowerCase(),
  );
  const githubInstallationBroken =
    githubSourceActive &&
    feed.isError &&
    (isGithubInstallationBrokenError(feed.error) ||
      (source === 'github-prs' && statusHasMatchingBrokenInstallation === true));

  return (
    <>
      {githubInstallationBroken && (
        <div className="flex flex-col gap-2 p-1">
          <Txt as="span" variant="ui-xs" className="text-icon3">
            GitHub installation removed. Reconnect to keep syncing{' '}
            {source === 'github-prs' ? 'pull requests' : 'issues'}.
          </Txt>
          <Button size="xs" onClick={() => manageGithubConnection(baseUrl)}>
            Reconnect GitHub
          </Button>
        </div>
      )}
      {source === 'linear' && linearIssues.isError && isLinearReauthError(linearIssues.error) && (
        <div className="flex flex-col gap-2 p-1">
          <Txt as="span" variant="ui-xs" className="text-icon3">
            Linear authorization expired. Reconnect to keep syncing issues.
          </Txt>
          <Button size="xs" onClick={() => connectLinear(baseUrl)}>
            Connect Linear
          </Button>
        </div>
      )}
      <LoadMoreSentinel
        hasNextPage={Boolean(feed.hasNextPage)}
        isFetchingNextPage={Boolean(feed.isFetchingNextPage)}
        onLoadMore={() => void feed.fetchNextPage()}
        label="Load more candidates"
      />
    </>
  );
}
