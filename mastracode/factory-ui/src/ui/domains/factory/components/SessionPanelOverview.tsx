import { useClock } from '@mastra/playground-ui/hooks/use-clock';
import type { ReactNode } from 'react';
import { useParams } from 'react-router';

import { SkeletonRows } from '../../../ui/SkeletonRows';
import { useFactoryQuery } from '../../../../hooks/useFactories';
import type { WorkspaceSectionSlots } from '../../workspace-viewer/context/WorkspacePanelContext';
import { cardProjectRepositoryId } from '../boardRepository';
import { changeRequestsHeading, changeRequestsNoun } from '../changeRequestState';
import { useSessionCard } from '../hooks/useSessionCard';
import { useSessionSubscriptions } from '../hooks/useSessionSubscriptions';
import { ownChangeRequest, sessionChangeRequests } from '../sessionChangeRequests';
import { relatedWorkItemIndex } from '../services/relationships';
import { genericExternalWorkItemUrl } from '../services/workItemPresentation';
import { toMinute } from '../stageStays';
import { CardDescription } from './CardDescription';
import { CardSourceRow } from './CardSourceRow';
import { ChangeRequestLink } from './ChangeRequestLink';
import { ChangeRequestList } from './ChangeRequestList';
import { MovesGraph } from './MovesGraph';
import { RelatedCards } from './RelatedCards';
import { SectionLoadError } from './SectionLoadError';

const sectionClass = 'flex flex-col gap-3 p-1.5 pb-3';

// Must render inside `ChatSessionBoundary`: the subscriptions follow the chat session.
export function SessionPanelOverview({ workspace }: { workspace: (slots?: WorkspaceSectionSlots) => ReactNode }) {
  const { factoryId } = useParams<{ factoryId: string }>();
  const { session, links } = useSessionSubscriptions();
  const { repository, provider } = session;
  const workspaceRepository = repository && { slug: repository.slug, provider };
  const factoryQuery = useFactoryQuery(factoryId);
  const card = useSessionCard();
  const now = useClock(toMinute);
  const pullRequestsFailed = session.failed || links.failed;

  // All at once: a section arriving late would push down the ones under it.
  if (card.loading || session.loading || links.pending || (card.item && card.boardsLoading)) {
    return <SkeletonRows label="Loading overview" rows={4} className="p-3" />;
  }

  if (card.failed || !card.item || !factoryId) {
    const requests = sessionChangeRequests({ subscriptions: links.subscriptions, provider });
    const providers = repository ? [provider] : [];
    return (
      <>
        {card.failed ? (
          <section aria-label="Card" className={sectionClass}>
            <SectionLoadError>Couldn't load the card.</SectionLoadError>
          </section>
        ) : null}
        {workspace({ repository: workspaceRepository })}
        {pullRequestsFailed || requests.length > 0 ? (
          <section aria-label={changeRequestsHeading(providers)} className={sectionClass}>
            {pullRequestsFailed ? (
              <SectionLoadError>{`Couldn't load ${changeRequestsNoun(providers)}.`}</SectionLoadError>
            ) : (
              <ChangeRequestList requests={requests} repository={repository?.slug} complete />
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
  const requestsNoun = changeRequestsNoun(repository ? [provider] : requests.map(request => request.provider));
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
      {workspace({
        repository: workspaceRepository,
        changeRequest: ownRequest ? (
          <ChangeRequestLink request={ownRequest} sessionRepository={repository?.slug} label="reference" />
        ) : undefined,
      })}
      {pullRequestsFailed || requests.length > 0 || showsPhases ? (
        <section aria-label="Card activity" className={sectionClass}>
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
