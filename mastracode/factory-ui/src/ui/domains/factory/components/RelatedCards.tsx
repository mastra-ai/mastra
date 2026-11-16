import { useQueries } from '@tanstack/react-query';

import { useApiConfig } from '../../../../api/config';
import type { InstalledBoardInfo } from '../../../../api/types';
import { userSessionQueryOptions } from '../../../../hooks/useWorkspaces';
import { PanelHeading } from '../../workspace-viewer/components/PanelHeading';
import type { PullRequestSubscription } from '../services/githubSubscriptions';
import type { WorkItem } from '../services/workItems';
import { CappedRows } from './CappedRows';
import { RelatedCardLink } from './RelatedCardLink';

/** The related cards' sessions the viewer can open: a deleted or hidden one answers 404 and is left out. */
function useLiveSessions(related: readonly WorkItem[]): string[] {
  const { baseUrl } = useApiConfig();
  const sessionIds = [...new Set(related.flatMap(item => Object.values(item.sessions).map(ref => ref.sessionId)))];
  return useQueries({
    queries: sessionIds.map(sessionId => userSessionQueryOptions(baseUrl, sessionId)),
    combine: results => sessionIds.filter((_, index) => results[index]?.data !== undefined),
  });
}

export function RelatedCards({
  related,
  boards,
  factoryId,
  repository,
  subscriptions,
}: {
  related: readonly WorkItem[];
  boards: readonly InstalledBoardInfo[] | undefined;
  factoryId: string;
  repository: string | undefined;
  subscriptions: readonly PullRequestSubscription[];
}) {
  const liveSessions = useLiveSessions(related);
  if (related.length === 0) return null;
  return (
    <div className="flex flex-col gap-0.5">
      <PanelHeading detail={related.length}>Related cards</PanelHeading>
      <CappedRows
        items={related}
        render={item => (
          <RelatedCardLink
            key={item.id}
            item={item}
            boards={boards}
            factoryId={factoryId}
            repository={repository}
            liveSessions={liveSessions}
            subscriptions={subscriptions}
          />
        )}
      />
    </div>
  );
}
