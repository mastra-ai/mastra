import { useClock } from '@mastra/playground-ui/hooks/use-clock';
import type { ReactNode } from 'react';
import { useParams } from 'react-router';

import { SkeletonRows } from '../../../ui/SkeletonRows';
import { useFactoryQuery } from '../../../../hooks/useFactories';
import { useThreadSubscriptions } from '../../chat/hooks/useThreadSubscriptions';
import { cardProjectRepositoryId } from '../boardRepository';
import { useSessionCard } from '../hooks/useSessionCard';
import { useSessionRepository } from '../hooks/useSessionRepository';
import { ownChangeRequest, sessionChangeRequests } from '../sessionChangeRequests';
import { relatedWorkItemIndex } from '../services/relationships';
import { genericExternalWorkItemUrl } from '../services/workItemPresentation';
import { toMinute } from '../stageStays';
import { CardChangeRequestRow } from './CardChangeRequestRow';
import { CardDescription } from './CardDescription';
import { CardSourceRow } from './CardSourceRow';
import { ChangeRequestList } from './ChangeRequestList';
import { MovesGraph } from './MovesGraph';
import { RelatedCards } from './RelatedCards';
import { SectionLoadError } from './SectionLoadError';

const sectionClass = 'flex flex-col gap-3 p-1.5 pb-3';

// Must render inside `ChatSessionBoundary`: the subscriptions follow the chat session.
export function SessionPanelOverview({ workspace }: { workspace: (changeRequest?: ReactNode) => ReactNode }) {
  const { factoryId, threadId } = useParams<{ factoryId: string; threadId: string }>();
  const session = useSessionRepository();
  const { repository, provider } = session;
  const factoryQuery = useFactoryQuery(factoryId);
  const links = useThreadSubscriptions(threadId, repository !== undefined, provider);
  const card = useSessionCard();
  const now = useClock(toMinute);
  const pullRequestsFailed = session.failed || links.failed;

  // All at once: a section arriving late would push down the ones under it.
  if (card.loading || session.loading || links.pending || (card.item && card.boardsLoading)) {
    return <SkeletonRows label="Loading overview" rows={4} className="p-3" />;
  }

  if (card.failed || !card.item || !factoryId) {
    const requests = sessionChangeRequests({ subscriptions: links.subscriptions, provider });
    return (
      <>
        {card.failed ? (
          <section aria-label="Card" className={sectionClass}>
            <SectionLoadError>Couldn't load the card.</SectionLoadError>
          </section>
        ) : null}
        {workspace()}
        {pullRequestsFailed || requests.length > 0 ? (
          <section aria-label="Pull requests" className={sectionClass}>
            {pullRequestsFailed ? (
              <SectionLoadError>Couldn't load pull requests.</SectionLoadError>
            ) : (
              <ChangeRequestList requests={requests} provider={provider} repository={repository?.slug} />
            )}
          </section>
        ) : null}
      </>
    );
  }

  const item = card.item;
  const related = relatedWorkItemIndex(card.sessionItems)(item);
  const ownRequest = ownChangeRequest(item, repository?.slug, links.subscriptions);
  const sourceUrl = genericExternalWorkItemUrl(item);
  const requests = sessionChangeRequests({
    item,
    subscriptions: links.subscriptions,
    provider,
    shownElsewhere: [sourceUrl, ownRequest?.url, ...related.map(relatedItem => relatedItem.url ?? undefined)],
  });
  const moved = item.stageHistory.some(entry => entry.exitedAt);
  const showsPhases = related.length > 0 || moved;

  return (
    <>
      <section aria-label="Card" className={`${sectionClass} empty:hidden`}>
        <CardSourceRow item={item} url={sourceUrl} repository={repository?.slug} />
        <CardDescription
          item={item}
          projectRepositoryId={cardProjectRepositoryId(
            factoryQuery.data?.repositories ?? [],
            item,
            repository?.projectRepositoryId,
          )}
          factoryId={factoryId}
          repositoryFailed={session.failed}
        />
      </section>
      {workspace(
        ownRequest ? (
          <CardChangeRequestRow item={item} request={ownRequest} repository={repository?.slug} />
        ) : undefined,
      )}
      {pullRequestsFailed || requests.length > 0 || showsPhases ? (
        <section aria-label="Card activity" className={sectionClass}>
          {pullRequestsFailed ? (
            <SectionLoadError>Couldn't load pull requests.</SectionLoadError>
          ) : (
            <ChangeRequestList requests={requests} provider={provider} repository={repository?.slug} />
          )}
          <RelatedCards
            related={related}
            boards={card.boards}
            factoryId={factoryId}
            repository={repository?.slug}
            subscriptions={links.subscriptions}
          />
          {card.boardsFailed && showsPhases ? (
            <SectionLoadError>Couldn't load the board, so phases aren't shown.</SectionLoadError>
          ) : moved ? (
            <MovesGraph history={item.stageHistory} board={card.board} now={now} />
          ) : null}
        </section>
      ) : null}
    </>
  );
}
