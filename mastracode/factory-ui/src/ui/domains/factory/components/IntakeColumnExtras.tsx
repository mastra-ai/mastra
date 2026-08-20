import { Button } from '@mastra/playground-ui/components/Button';
import { Txt } from '@mastra/playground-ui/components/Txt';

import { useApiConfig } from '../../../../api/config';
import type { useProjectIssuesQuery, useProjectPullRequestsQuery } from '../../../../hooks/useFactoryData';
import type { useJiraIssuesQuery } from '../../../../hooks/useJiraData';
import type { useLinearIssuesQuery } from '../../../../hooks/useLinearData';
import type { IntakeSource } from '../boardCandidates';
import { isJiraAuthError } from '../services/jira';
import { connectLinear, isLinearReauthError } from '../services/linear';
import { LoadMoreSentinel } from './LoadMoreSentinel';

/**
 * Intake column tail for the ACTIVE candidate feed: loading state, provider
 * auth notices, and pagination. Only one feed is browsed at a time, so only
 * its states render.
 */
export function IntakeColumnExtras({
  source,
  issues,
  pulls,
  linearIssues,
  jiraIssues,
}: {
  source?: IntakeSource;
  issues: ReturnType<typeof useProjectIssuesQuery>;
  pulls: ReturnType<typeof useProjectPullRequestsQuery>;
  linearIssues: ReturnType<typeof useLinearIssuesQuery>;
  jiraIssues: ReturnType<typeof useJiraIssuesQuery>;
}) {
  const { baseUrl } = useApiConfig();
  if (source === undefined) return null;
  const feed =
    source === 'github' ? issues : source === 'github-prs' ? pulls : source === 'jira' ? jiraIssues : linearIssues;

  return (
    <>
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
      {source === 'jira' && jiraIssues.isError && isJiraAuthError(jiraIssues.error) && (
        // Jira is env-configured — there is no reconnect flow to offer.
        <div className="flex flex-col gap-2 p-1">
          <Txt as="span" variant="ui-xs" className="text-icon3">
            Jira rejected the configured credentials. Ask the operator to check the Jira API token.
          </Txt>
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
