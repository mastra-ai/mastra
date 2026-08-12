import { Button } from '@mastra/playground-ui/components/Button';
import { Txt } from '@mastra/playground-ui/components/Txt';

import { useApiConfig } from '../../../../api/config';
import type { useProjectIssuesQuery, useProjectPullRequestsQuery } from '../../../../hooks/useFactoryData';
import type { useLinearIssuesQuery } from '../../../../hooks/useLinearData';
import type { IntakeSource } from '../boardCandidates';
import { getIntegrationReauthInfo } from '../services/integration-reauth';
import { LoadMoreSentinel } from './LoadMoreSentinel';

/**
 * Intake column tail for the ACTIVE candidate feed: loading state, integration
 * reauth notice, and pagination. Only one feed is browsed at a time, so only
 * its states render.
 */
export function IntakeColumnExtras({
  source,
  issues,
  pulls,
  linearIssues,
}: {
  source?: IntakeSource;
  issues: ReturnType<typeof useProjectIssuesQuery>;
  pulls: ReturnType<typeof useProjectPullRequestsQuery>;
  linearIssues: ReturnType<typeof useLinearIssuesQuery>;
}) {
  const { baseUrl } = useApiConfig();
  if (source === undefined) return null;
  const feed = source === 'github' ? issues : source === 'github-prs' ? pulls : linearIssues;
  const reauthInfo = feed.isError ? getIntegrationReauthInfo(feed.error) : null;

  return (
    <>
      {reauthInfo && (
        <div className="flex flex-col gap-2 p-1">
          <Txt as="span" variant="ui-xs" className="text-icon3">
            {reauthInfo.message}
          </Txt>
          <Button size="xs" onClick={() => window.location.assign(`${baseUrl}${reauthInfo.connectPath}`)}>
            Reconnect
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
