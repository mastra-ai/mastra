import type { InstalledBoardInfo } from '../../../../api/types';
import { useWorkspacesQuery } from '../../../../hooks/useWorkspaces';
import { PanelHeading } from '../../workspace-viewer/components/PanelHeading';
import type { PullRequestSubscription } from '../services/githubSubscriptions';
import type { WorkItem } from '../services/workItems';
import { CappedRows } from './CappedRows';
import { RelatedCardLink } from './RelatedCardLink';

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
  const workspaces = useWorkspacesQuery(factoryId);
  const liveSessions = (workspaces.data?.workspaces ?? []).map(workspace => workspace.sessionId);
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
