import { useClock } from '@mastra/playground-ui/hooks/use-clock';

import type { InstalledBoardInfo } from '../../../../api/types';
import { useFactoryQuery } from '../../../../hooks/useFactories';
import type { WorkspaceSlot } from '../../workspace-viewer/context/WorkspacePanelContext';
import { WorkspaceSectionSkeleton } from '../../workspace-viewer/components/WorkspaceSection';
import type { LinkedRepositoryPayload } from '../../workspaces/services/github';
import { boardOf } from '../boardFlow';
import { repositoryProvider } from '../hooks/useSessionRepository';
import { cardProjectRepositoryId } from '../boardRepository';
import { changeRequestsNoun } from '../changeRequestState';
import { ownChangeRequest, sessionChangeRequests } from '../sessionChangeRequests';
import type { PullRequestSubscription } from '../services/githubSubscriptions';
import { relatedWorkItemIndex } from '../services/relationships';
import { genericExternalWorkItemUrl } from '../services/workItemPresentation';
import type { WorkItem } from '../services/workItems';
import { toMinute } from '../stageStays';
import { SourceDescriptionLines } from './BoardCardDetails';
import { CardDescription } from './CardDescription';
import { CardSourceRow } from './CardSourceRow';
import { ChangeRequestBadge } from './ChangeRequestBadge';
import { ChangeRequestLink } from './ChangeRequestLink';
import { ChangeRequestList } from './ChangeRequestList';
import { MovesGraph } from './MovesGraph';
import { RelatedCards } from './RelatedCards';
import { SectionLoadError } from './SectionLoadError';

export const overviewSectionClass = 'flex flex-col gap-3 p-1.5 pb-3';

export function OverviewSkeleton({ workspace = false }: { workspace?: boolean }) {
  return (
    <>
      <section role="status" aria-label="Loading overview" className={overviewSectionClass}>
        <SourceDescriptionLines />
      </section>
      {workspace ? <WorkspaceSectionSkeleton /> : null}
    </>
  );
}

export function CardOverview({
  item,
  sessionItems,
  factoryId,
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
  factoryId: string;
  boards: readonly InstalledBoardInfo[] | undefined;
  boardsFailed: boolean;
  repository: LinkedRepositoryPayload | undefined;
  repositoryFailed: boolean;
  subscriptions: readonly PullRequestSubscription[];
  pullRequestsFailed: boolean;
  workspace?: WorkspaceSlot;
}) {
  const factoryQuery = useFactoryQuery(factoryId);
  const now = useClock(toMinute);
  const provider = repositoryProvider(repository);
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
    <>
      <section aria-label="Card" className={`${overviewSectionClass} empty:hidden`}>
        {!workspace && ownRequest ? (
          <ChangeRequestLink request={ownRequest} sessionRepository={repository?.slug} label="reference" />
        ) : null}
        <CardSourceRow item={item} url={sourceUrl} repository={repository?.slug} />
        <CardDescription
          item={item}
          projectRepositoryId={cardProjectRepositoryId(
            factoryQuery.data?.repositories ?? [],
            item,
            repository?.projectRepositoryId,
          )}
          factoryId={factoryId}
          repositoryFailed={repositoryFailed}
        />
      </section>
      {workspace?.({
        repository: repository && { slug: repository.slug, provider },
        changeRequest: ownRequest && {
          badge: <ChangeRequestBadge request={ownRequest} sessionRepository={repository?.slug} />,
          status: ownRequest.status,
        },
      })}
      {pullRequestsFailed || requests.length > 0 || showsPhases ? (
        <section aria-label="Card activity" className={overviewSectionClass}>
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
            factoryId={factoryId}
            repository={repository?.slug}
            subscriptions={subscriptions}
          />
          {boardsFailed && showsPhases ? (
            <SectionLoadError>Couldn't load the board, so phases aren't shown.</SectionLoadError>
          ) : moved ? (
            <MovesGraph history={item.stageHistory} board={boardOf(boards, item)} now={now} />
          ) : null}
        </section>
      ) : null}
    </>
  );
}
