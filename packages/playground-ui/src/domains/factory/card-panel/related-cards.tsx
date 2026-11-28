import type { WorkItem } from '@internal/factory-contract';

import type { InstalledBoardInfo } from '@mastra/client-js';
import { PanelHeading } from '..';
import type { PullRequestSubscription } from '..';
import { CappedRows } from './capped-rows';
import { useCardPanelHost } from './card-panel-host';
import { CardPanelRelatedCardLink } from './related-card-link';

export function RelatedCards({
  related,
  boards,
  repository,
  subscriptions,
}: {
  related: readonly WorkItem[];
  boards: readonly InstalledBoardInfo[] | undefined;
  repository: string | undefined;
  subscriptions: readonly PullRequestSubscription[];
}) {
  const sessionIds = [...new Set(related.flatMap(item => Object.values(item.sessions).map(ref => ref.sessionId)))];
  const liveSessions = useCardPanelHost().useLiveSessions(sessionIds);
  if (related.length === 0) return null;
  return (
    <div className="flex flex-col gap-0.5">
      <PanelHeading detail={related.length}>Related cards</PanelHeading>
      <CappedRows
        items={related}
        render={item => (
          <CardPanelRelatedCardLink
            key={item.id}
            item={item}
            boards={boards}
            repository={repository}
            liveSessions={liveSessions}
            subscriptions={subscriptions}
          />
        )}
      />
    </div>
  );
}
