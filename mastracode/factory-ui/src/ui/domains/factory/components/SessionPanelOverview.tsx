import { useParams } from 'react-router';

import type { WorkspaceSlot } from '../../workspace-viewer/context/WorkspacePanelContext';
import { changeRequestsHeading, changeRequestsNoun } from '../changeRequestState';
import { useSessionCard } from '../hooks/useSessionCard';
import { useSessionSubscriptions } from '../hooks/useSessionSubscriptions';
import { sessionChangeRequests } from '../sessionChangeRequests';
import { CardOverview, OverviewSkeleton, overviewSectionClass } from './CardOverview';
import { ChangeRequestList } from './ChangeRequestList';
import { SectionLoadError } from './SectionLoadError';

// Must render inside `ChatSessionBoundary`: the subscriptions follow the chat session.
export function SessionPanelOverview({ workspace }: { workspace: WorkspaceSlot | undefined }) {
  const { factoryId } = useParams<{ factoryId: string }>();
  const { session, links } = useSessionSubscriptions();
  const { repository, provider } = session;
  const card = useSessionCard();
  const pullRequestsFailed = session.failed || links.failed;

  // All at once: a section arriving late would push down the ones under it.
  if (card.loading || session.loading || links.pending || (card.item && card.boardsLoading)) {
    return <OverviewSkeleton />;
  }

  if (card.failed || !card.item || !factoryId) {
    const requests = sessionChangeRequests({ subscriptions: links.subscriptions, provider });
    const providers = repository ? [provider] : [];
    return (
      <>
        {card.failed ? (
          <section aria-label="Card" className={overviewSectionClass}>
            <SectionLoadError>Couldn't load the card.</SectionLoadError>
          </section>
        ) : null}
        {workspace?.({ repository: repository && { slug: repository.slug, provider } })}
        {pullRequestsFailed || requests.length > 0 ? (
          <section aria-label={changeRequestsHeading(providers)} className={overviewSectionClass}>
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

  return (
    <CardOverview
      item={card.item}
      sessionItems={card.sessionItems}
      factoryId={factoryId}
      boards={card.boards}
      boardsFailed={card.boardsFailed}
      repository={repository}
      repositoryFailed={session.failed}
      subscriptions={links.subscriptions}
      pullRequestsFailed={pullRequestsFailed}
      workspace={workspace}
    />
  );
}
