import { Badge } from '@mastra/playground-ui/components/Badge';
import type { BadgeVariant } from '@mastra/playground-ui/components/Badge';
import { Button } from '@mastra/playground-ui/components/Button';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useClock } from '@mastra/playground-ui/hooks/use-clock';
import type { ReactNode } from 'react';
import { Link, useParams } from 'react-router';

import type { InstalledBoardInfo } from '../../../../api/types';
import { useFactoryQuery } from '../../../../hooks/useFactories';
import { useUserSessionQuery, useWorkspacesQuery } from '../../../../hooks/useWorkspaces';
import { usePullRequestSubscriptions } from '../../chat/hooks/usePullRequestSubscriptions';
import { boardOf } from '../boardFlow';
import { gitlabIdentifierForItem, linearIdentifierForItem, SOURCE_LABELS, sourceMetadata } from '../boardItems';
import type { PullRequestStatus } from '../boardItems';
import { currentItemStageLabel } from '../boardStages';
import { useSessionCard } from '../hooks/useSessionCard';
import { changeRequestReference, ownChangeRequest, sessionChangeRequests } from '../sessionChangeRequests';
import type { SessionChangeRequest } from '../sessionChangeRequests';
import type { ChangeRequestProvider } from '../services/githubSubscriptions';
import {
  relatedWorkItemIndex,
  relationshipLabel,
  relationshipPath,
  workItemNumber,
  workItemReferenceLabel,
} from '../services/relationships';
import type { WorkItem } from '../services/workItems';
import { genericExternalWorkItemUrl } from '../services/workItemPresentation';
import { MetadataLabels } from './BoardCardParts';
import { SourceIcon } from './BoardIcons';
import { MovesGraph } from './MovesGraph';

const STATUS_CHIPS: Record<PullRequestStatus, { label: string; variant: BadgeVariant }> = {
  open: { label: 'Open', variant: 'green' },
  draft: { label: 'Draft', variant: 'neutral' },
  merged: { label: 'Merged', variant: 'purple' },
  closed: { label: 'Closed', variant: 'red' },
};

/** The card's source by its number in the repository the session works in, which the panel needs no slug to say. */
function externalWorkItemLabel(item: WorkItem): string {
  const number = workItemNumber(item);
  if (item.source === 'github-issue') return number ? `Issue #${number}` : 'Issue';
  if (item.source === 'github-pr') return number ? `PR #${number}` : 'PR';
  if (item.source === 'gitlab-pr') return number ? `MR !${number}` : 'MR';
  if (item.source === 'gitlab-issue') {
    const stored = sourceMetadata(item).gitlabIssueIid;
    // Cards without the iid carry GitLab's `group/project#3`, whose first half the session's repository already says.
    const iid =
      typeof stored === 'number' && Number.isSafeInteger(stored) && stored > 0
        ? String(stored)
        : gitlabIdentifierForItem(item)?.match(/#(\d+)$/)?.[1];
    return iid ? `Issue #${iid}` : 'Issue';
  }
  if (item.source === 'linear-issue') return linearIdentifierForItem(item) ?? number ?? 'Linear issue';
  return workItemReferenceLabel(item) ?? SOURCE_LABELS[item.source];
}

/** Open or closed, when the source says which in words a chip can carry. */
function sourceStatus(item: WorkItem): { label: string; variant: BadgeVariant } | undefined {
  const state = item.workItem?.state ?? sourceMetadata(item).state;
  if (state === 'open' || state === 'opened') return { label: 'Open', variant: 'green' };
  if (state === 'closed') return { label: 'Closed', variant: 'neutral' };
  return undefined;
}

/**
 * What the session panel shows above the workspace: the card the session works and where it
 * stands, or, for a session without a card, the pull requests its thread subscribes to.
 *
 * Must render inside `ChatSessionBoundary`: the subscriptions follow the chat session and transcript.
 */
export function SessionPanelSummary() {
  const { factoryId, sessionId, threadId } = useParams<{ factoryId: string; sessionId: string; threadId: string }>();
  // User threads carry the session id as `threadId` (see ChatSessionProvider).
  const session = useUserSessionQuery(sessionId ?? threadId);
  const factory = useFactoryQuery(factoryId).data;
  const repository = factory?.repositories.find(
    candidate => candidate.projectRepositoryId === session.data?.projectRepositoryId,
  );
  const provider: ChangeRequestProvider = repository?.provider === 'gitlab' ? 'gitlab' : 'github';
  const subscriptions = usePullRequestSubscriptions(threadId, Boolean(repository), provider);
  const card = useSessionCard();

  if (card.loading) return null;

  if (!card.item || !factoryId) {
    const requests = sessionChangeRequests({ subscriptions, provider });
    if (requests.length === 0) return null;
    return (
      <section aria-label="Pull requests" className="border-border flex flex-col gap-1 border-b p-1.5">
        <PanelHeading count={requests.length}>
          {provider === 'gitlab' ? 'Merge requests' : 'Pull requests'}
        </PanelHeading>
        {requests.map(request => (
          <ChangeRequestLink key={request.url} request={request} />
        ))}
      </section>
    );
  }

  const related = relatedWorkItemIndex(card.sessionItems)(card.item);
  // A pull request card's source is its own pull request, which knows more states than open or closed.
  const own = ownChangeRequest(card.item, repository?.slug);
  const source = {
    url: genericExternalWorkItemUrl(card.item) ?? own?.url,
    chip: own ? STATUS_CHIPS[own.status] : sourceStatus(card.item),
  };
  const requests = sessionChangeRequests({
    item: card.item,
    repositorySlug: repository?.slug,
    subscriptions,
    provider,
    // The card's source heads the panel, and a pull request with its own card is reached through that card.
    shownElsewhere: [source.url, ...related.map(relatedItem => relatedItem.url)],
  });

  return (
    <CardSummary
      item={card.item}
      board={card.board}
      boards={card.boards}
      factoryId={factoryId}
      source={source}
      requests={requests}
      related={related}
    />
  );
}

function CardSummary({
  item,
  board,
  boards,
  factoryId,
  source,
  requests,
  related,
}: {
  item: WorkItem;
  board: InstalledBoardInfo | undefined;
  boards: readonly InstalledBoardInfo[] | undefined;
  factoryId: string;
  source: { url: string | undefined; chip: { label: string; variant: BadgeVariant } | undefined };
  requests: SessionChangeRequest[];
  related: WorkItem[];
}) {
  // The moves' stays read to the minute, so the panel draws again once a minute.
  const now = useClock(time => Math.floor(time / 60_000) * 60_000);
  const workspaces = useWorkspacesQuery(factoryId);
  const livePaths = new Set((workspaces.data?.workspaces ?? []).map(workspace => workspace.sessionId));
  const sourceLabel = externalWorkItemLabel(item);
  // The stage bar shows where the card is now, so the moves are the stays that brought it there.
  const moveCount = item.stageHistory.filter(entry => entry.exitedAt).length;

  return (
    <section aria-label="Card" className="border-border flex flex-col gap-3 border-b p-1.5 pb-3">
      <div className="flex flex-col gap-1 px-2 pt-1.5">
        {/*
          The card's source shows once, here: which one it is, linked, and its state, on one line that fits the
          panel. Its author and age stay at the source, one click away. Links below hold what else the work touched.
        */}
        <div className="flex min-w-0 items-center gap-1.5">
          <Txt as="span" variant="meta" tone="muted" className="flex min-w-0">
            {source.url ? (
              <a
                href={source.url}
                target="_blank"
                rel="noreferrer"
                aria-label={`Open ${sourceLabel}`}
                className="hover:text-foreground inline-flex min-w-0 items-center gap-1.5 transition-colors"
              >
                <SourceIcon source={item.source} className="size-3.5 shrink-0" />
                <span className="truncate">{sourceLabel}</span>
              </a>
            ) : (
              <span className="inline-flex min-w-0 items-center gap-1.5">
                <SourceIcon source={item.source} className="size-3.5 shrink-0" />
                <span className="truncate">{sourceLabel}</span>
              </span>
            )}
          </Txt>
          {source.chip ? <StatusChip {...source.chip} /> : null}
        </div>
        <Txt as="h2" variant="body-sm" tone="ink" className="line-clamp-2">
          {item.title}
        </Txt>
        <MetadataLabels metadata={sourceMetadata(item)} />
      </div>

      {requests.length > 0 ? (
        <div className="flex flex-col gap-0.5">
          <PanelHeading count={requests.length}>Links</PanelHeading>
          {requests.map(request => (
            <ChangeRequestLink key={request.url} request={request} />
          ))}
        </div>
      ) : null}

      {related.length > 0 ? (
        <div className="flex flex-col gap-0.5">
          <PanelHeading count={related.length}>Separate cards</PanelHeading>
          {related.map(relatedItem => {
            const session = Object.values(relatedItem.sessions)
              .filter(candidate => livePaths.has(candidate.sessionId))
              .at(-1);
            const to = session
              ? `/factories/${factoryId}/workspaces/${session.sessionId}/threads/${session.threadId}`
              : relationshipPath(relatedItem, factoryId);
            return (
              <Button
                key={relatedItem.id}
                variant="ghost"
                size="sm"
                className="w-full justify-start"
                aria-label={`Open ${relationshipLabel(relatedItem)}: ${relatedItem.title}`}
                render={<Link to={to} />}
              >
                {/* The heading says these are cards and the icon what kind, so the row names only which one. */}
                <SourceIcon source={relatedItem.source} className="size-3.5" />
                <span className="truncate">{workItemReferenceLabel(relatedItem) ?? relatedItem.title}</span>
                <Txt as="span" variant="meta" tone="muted" className="ml-auto shrink-0">
                  {currentItemStageLabel(relatedItem, boardOf(boards, relatedItem))}
                </Txt>
              </Button>
            );
          })}
        </div>
      ) : null}

      {moveCount > 0 ? (
        <div className="flex flex-col gap-0.5">
          <PanelHeading count={moveCount}>Moves</PanelHeading>
          <MovesGraph history={item.stageHistory} board={board} now={now} />
        </div>
      ) : null}
    </section>
  );
}

function PanelHeading({ count, children }: { count?: number; children: ReactNode }) {
  return (
    <Txt as="h3" variant="meta" tone="muted" className="flex items-center gap-1.5 px-2 py-1">
      {children}
      {count === undefined ? null : (
        <>
          {/* The space keeps the count its own word for screen readers: "Links 2". */}{' '}
          <Txt as="span" variant="meta" tone="faint">
            {count}
          </Txt>
        </>
      )}
    </Txt>
  );
}

function StatusChip({ label, variant }: { label: string; variant: BadgeVariant }) {
  return (
    <Badge variant={variant} emphasis="subtle" size="xs" className="ml-auto">
      {label}
    </Badge>
  );
}

function ChangeRequestLink({ request }: { request: SessionChangeRequest }) {
  const reference = changeRequestReference(request);
  return (
    <Button
      render={<a href={request.url} target="_blank" rel="noreferrer" />}
      variant="ghost"
      size="sm"
      className="w-full justify-start"
      aria-label={request.status === 'open' ? `Open ${reference}` : `Open ${reference} ${request.status}`}
    >
      <SourceIcon source={request.provider === 'gitlab' ? 'gitlab-pr' : 'github-pr'} className="size-3.5" />
      <span className="truncate">{reference}</span>
      <StatusChip {...STATUS_CHIPS[request.status]} />
    </Button>
  );
}
