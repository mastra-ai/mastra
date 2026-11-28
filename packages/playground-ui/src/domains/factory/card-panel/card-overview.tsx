import type { WorkItem } from '@internal/factory-contract';
import type { InstalledBoardInfo } from '@mastra/client-js';

import type { PullRequestSubscription } from '..';
import {
  CardOverview as SharedCardOverview,
  OverviewSkeleton as SharedOverviewSkeleton,
  boardOf,
  changeRequestsNoun,
  ownChangeRequest,
  sessionChangeRequests,
  relatedWorkItemIndex,
  genericExternalWorkItemUrl,
  SectionLoadError,
} from '..';

import { CardPanelDescription } from './card-description';
import { CardPanelMovesGraph } from './card-moves-graph';
import { useCardPanelHost } from './card-panel-host';
import type { CardPanelRepository, CardWorkspaceSlot } from './card-panel-host';
import { CardPanelSourceRow } from './card-source-row';
import { ChangeRequestBadge } from './change-request-badge';
import { ChangeRequestLink } from './change-request-link';
import { ChangeRequestList } from './change-request-list';
import { RelatedCards } from './related-cards';
import { toMinute } from './stage-stays';
import { useClock } from '@/hooks/use-clock';

export function CardPanelOverviewSkeleton({ workspace = false }: { workspace?: boolean }) {
  const host = useCardPanelHost();
  return <SharedOverviewSkeleton workspace={workspace ? (host.workspaceSkeleton ?? null) : null} />;
}

export function CardPanelOverview({
  item,
  sessionItems,
  boards,
  boardsFailed,
  repository,
  repositoryFailed,
  subscriptions,
  pullRequestsFailed,
  workspace,
}: {
  item: WorkItem;
  sessionItems: readonly WorkItem[];
  boards: readonly InstalledBoardInfo[] | undefined;
  boardsFailed: boolean;
  repository: CardPanelRepository | undefined;
  repositoryFailed: boolean;
  subscriptions: readonly PullRequestSubscription[];
  pullRequestsFailed: boolean;
  workspace?: CardWorkspaceSlot;
}) {
  const now = useClock(toMinute);
  const provider = repository?.provider === 'gitlab' ? 'gitlab' : 'github';
  const related = relatedWorkItemIndex(sessionItems)(item);
  const ownRequest = ownChangeRequest(item, repository?.slug, subscriptions);
  const sourceUrl = genericExternalWorkItemUrl(item);
  const requests = sessionChangeRequests({
    item,
    subscriptions,
    provider,
    shownElsewhere: [sourceUrl, ownRequest?.url],
  });
  const requestsNoun = changeRequestsNoun(repository ? [provider] : requests.map(request => request.provider));
  const moved = item.stageHistory.some(entry => entry.exitedAt);
  const showsPhases = related.length > 0 || moved;

  return (
    <SharedCardOverview
      reference={
        !workspace && ownRequest ? (
          <ChangeRequestLink request={ownRequest} sessionRepository={repository?.slug} label="reference" />
        ) : null
      }
      source={<CardPanelSourceRow item={item} url={sourceUrl} repository={repository?.slug} />}
      description={<CardPanelDescription item={item} repository={repository} repositoryFailed={repositoryFailed} />}
      workspace={workspace?.({
        repository: repository && { slug: repository.slug, provider },
        changeRequest: ownRequest && {
          badge: <ChangeRequestBadge request={ownRequest} sessionRepository={repository?.slug} />,
          status: ownRequest.status,
        },
      })}
      activity={
        pullRequestsFailed || requests.length > 0 || showsPhases ? (
          <>
            <ChangeRequestList requests={requests} repository={repository?.slug} complete={!pullRequestsFailed} />
            {pullRequestsFailed ? (
              <SectionLoadError>
                {requests.length > 0
                  ? `Couldn't load the session's ${requestsNoun}, so this list may be out of date.`
                  : `Couldn't load ${requestsNoun}.`}
              </SectionLoadError>
            ) : null}
            <RelatedCards
              related={related}
              boards={boards}
              repository={repository?.slug}
              subscriptions={subscriptions}
            />
            {boardsFailed && showsPhases ? (
              <SectionLoadError>Couldn't load the board, so phases aren't shown.</SectionLoadError>
            ) : moved ? (
              <CardPanelMovesGraph history={item.stageHistory} board={boardOf(boards, item)} now={now} />
            ) : null}
          </>
        ) : null
      }
    />
  );
}
