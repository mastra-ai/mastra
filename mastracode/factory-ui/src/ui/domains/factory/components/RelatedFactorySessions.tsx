import { Txt } from '@mastra/playground-ui/components/Txt';
import { Crumb } from '@mastra/playground-ui/components/Breadcrumb';
import { Button } from '@mastra/playground-ui/components/Button';
import type { ReactNode } from 'react';
import { Link, useMatch, useParams } from 'react-router';

import { useBoardCatalog } from '../../../../hooks/useBoardCatalog';
import { useUserSessionQuery, useWorkspacesQuery } from '../../../../hooks/useWorkspaces';
import { useWorkItemsQuery } from '../../../../hooks/useWorkItems';
import { ChatPageLayout } from '../../chat/components/ChatPageLayout';
import { getUserSessionLabel } from '../../workspaces/services/sessionPresentation';
import { UserSessionSharing } from '../../workspaces/components/UserSessionSharing';
import { WorkspaceFilesToggle } from '../../workspace-viewer/components/WorkspaceFilesToggle';
import { cardContextSessions, linearIdentifierForItem, phaseContext } from '../boardItems';
import type { ContextPhase } from '../boardItems';
import { itemBoard } from '../boardStages';
import { rememberedBoardPath } from '../services/boardViews';
import { relatedWorkItemIndex, relationshipLabel, relationshipPath, workItemNumber } from '../services/relationships';
import type { WorkItem, WorkItemSessionRef } from '../services/workItems';
import { isPullRequestSource } from '../services/workItems';
import { genericExternalWorkItemUrl } from '../services/workItemPresentation';
import { SourceIcon } from './BoardIcons';
import { FactoryReviewPullRequestLinks } from './FactoryReviewPullRequestLinks';
import { IconChainLink1 } from '@mastra/playground-ui/icons/central/IconChainLink1';

function latestLiveSession(item: WorkItem, livePaths: ReadonlySet<string>): WorkItemSessionRef | undefined {
  return Object.values(item.sessions)
    .filter(session => livePaths.has(session.sessionId))
    .at(-1);
}

function sessionTitle(item: WorkItem): string {
  const number = workItemNumber(item);
  if (item.source === 'github-pr' && number) return `PR #${number}: ${item.title}`;
  if (item.source === 'gitlab-pr' && number) return `MR !${number}: ${item.title}`;
  if (item.source === 'github-issue' && number) return `Issue #${number}: ${item.title}`;
  return item.title;
}

function externalWorkItemLabel(item: WorkItem): string {
  const number = workItemNumber(item);
  if (item.source === 'github-pr') return number ? `PR #${number}` : 'Pull request';
  if (item.source === 'gitlab-pr') return number ? `MR !${number}` : 'Merge request';
  if (item.source === 'github-issue') return number ? `Issue #${number}` : 'Issue';
  if (item.source === 'linear-issue') {
    return linearIdentifierForItem(item) ?? number ?? 'Linear issue';
  }
  return 'Work item';
}

function activeWorkItem(
  items: WorkItem[],
  factoryId?: string,
  sessionId?: string,
  threadId?: string,
): WorkItem | undefined {
  if (!factoryId || !sessionId || !threadId) return undefined;
  return items.find(item =>
    Object.values(item.sessions).some(session => session.threadId === threadId && session.sessionId === sessionId),
  );
}

/** The context this session runs in, and the phase the card is in when that runs elsewhere. */
function sessionContextCrumb(
  item: WorkItem,
  phases: readonly ContextPhase[] | undefined,
  sessionId: string,
  threadId: string,
): { label: string; cardPhase?: string } | undefined {
  const stage = item.stages[0];
  if (stage === undefined) return undefined;
  const entry = cardContextSessions(item, phases, stage).find(
    candidate => candidate.ref.sessionId === sessionId && candidate.ref.threadId === threadId,
  );
  if (!entry) return undefined;
  const currentPhase = phases?.find(phase => phase.id === stage);
  // A context no phase runs in (self-review's `review`, legacy `plan`) is not
  // one the card moves out of, so the card being elsewhere says nothing.
  const phaseRunsHere = phases?.some(phase => phaseContext(phase) === entry.context);
  if (entry.current || !phaseRunsHere || !currentPhase || phaseContext(currentPhase) === undefined) {
    return { label: entry.label };
  }
  return { label: entry.label, cardPhase: currentPhase.name ?? currentPhase.title };
}

/** Chat page frame for a factory thread: breadcrumb of the work item or session, plus its actions. */
export function FactorySessionPage({ children }: { children: ReactNode }) {
  const { factoryId, sessionId, threadId } = useParams<{ factoryId: string; sessionId: string; threadId: string }>();
  // User threads carry the session id as `threadId` (see ChatSessionProvider).
  const isUserThread = Boolean(useMatch('/factories/:factoryId/user/threads/:threadId'));
  const userSessionId = sessionId ?? threadId;
  const sessionQuery = useUserSessionQuery(userSessionId);
  const projectRepositoryId = sessionQuery.data?.projectRepositoryId;
  const items = useWorkItemsQuery(factoryId);
  const workspaces = useWorkspacesQuery(factoryId);
  const catalog = useBoardCatalog(factoryId);

  const allItems = items.data ?? [];
  const currentItem = activeWorkItem(allItems, factoryId, sessionId, threadId);
  // Prefer the list row: PageTitle patches it with the generated title, the detail cache is not updated.
  const session = workspaces.data?.userSessions.find(entry => entry.sessionId === userSessionId) ?? sessionQuery.data;
  const workspaceTitle = !isUserThread && !currentItem ? session?.title?.trim() : undefined;
  const livePaths = new Set((workspaces.data?.workspaces ?? []).map(workspace => workspace.sessionId));
  const isReview = currentItem ? isPullRequestSource(currentItem.source) : false;
  const contextCrumb =
    currentItem && sessionId && threadId
      ? sessionContextCrumb(
          currentItem,
          catalog.data?.find(board => board.id === itemBoard(currentItem))?.phases,
          sessionId,
          threadId,
        )
      : undefined;

  const crumbs =
    currentItem && factoryId ? (
      <>
        <Crumb as={Link} to={rememberedBoardPath(factoryId, isReview ? 'review' : 'work')}>
          {isReview ? 'Review' : 'Work'}
        </Crumb>
        <Crumb as="span" isCurrent={!contextCrumb}>
          {sessionTitle(currentItem)}
        </Crumb>
        {contextCrumb ? (
          <Crumb as="span" isCurrent>
            <span className="flex items-baseline gap-2">
              <span>{contextCrumb.label}</span>
              {contextCrumb.cardPhase ? (
                <span className="text-muted-foreground">card is now in {contextCrumb.cardPhase}</span>
              ) : null}
            </span>
          </Crumb>
        ) : null}
      </>
    ) : isUserThread && session ? (
      <>
        <Crumb as="span">User sessions</Crumb>
        <Crumb as="span" isCurrent>
          {getUserSessionLabel(session)}
        </Crumb>
      </>
    ) : workspaceTitle ? (
      <>
        <Crumb as="span">Sessions</Crumb>
        <Crumb as="span" isCurrent>
          {workspaceTitle}
        </Crumb>
      </>
    ) : undefined;

  return (
    <ChatPageLayout
      crumbs={crumbs}
      headerActions={
        <>
          {isUserThread && factoryId && session ? <UserSessionSharing factoryId={factoryId} session={session} /> : null}
          {currentItem && factoryId && threadId ? (
            <WorkItemActions
              item={currentItem}
              allItems={allItems}
              livePaths={livePaths}
              factoryId={factoryId}
              threadId={threadId}
              projectRepositoryId={projectRepositoryId}
            />
          ) : null}
          <WorkspaceFilesToggle />
        </>
      }
    >
      {children}
    </ChatPageLayout>
  );
}

function WorkItemActions({
  item,
  allItems,
  livePaths,
  factoryId,
  threadId,
  projectRepositoryId,
}: {
  item: WorkItem;
  allItems: WorkItem[];
  livePaths: ReadonlySet<string>;
  factoryId: string;
  threadId: string;
  projectRepositoryId?: string;
}) {
  const externalItemUrl = genericExternalWorkItemUrl(item);
  const externalItemLabel = externalWorkItemLabel(item);

  return (
    <>
      {externalItemUrl ? (
        <Button
          as="a"
          variant="ghost"
          size="sm"
          href={externalItemUrl}
          target="_blank"
          rel="noreferrer"
          aria-label={`Open ${externalItemLabel}`}
        >
          <SourceIcon source={item.source} className="size-3.5" />
          {externalItemLabel}
        </Button>
      ) : null}
      {relatedWorkItemIndex(allItems)(item).map(related => {
        const label = relationshipLabel(related);
        const session = latestLiveSession(related, livePaths);

        if (!session) {
          return (
            <Link
              to={relationshipPath(related, factoryId)}
              aria-label={`Open ${label}: ${related.title}`}
              key={related.id}
              className="text-muted-foreground hover:bg-fill hover:text-foreground flex items-center gap-1.5 rounded-md px-2 py-1"
            >
              <IconChainLink1 size={13} aria-hidden />
              <Txt as="span" variant="caption" className="block">
                {label}
              </Txt>
            </Link>
          );
        }

        return (
          <Button
            key={related.id}
            variant="ghost"
            size="sm"
            aria-label={`Open ${label}: ${related.title}`}
            render={<Link to={`/factories/${factoryId}/workspaces/${session.sessionId}/threads/${session.threadId}`} />}
          >
            <IconChainLink1 size={13} aria-hidden />
            {label}
          </Button>
        );
      })}
      {isPullRequestSource(item.source) ? (
        <FactoryReviewPullRequestLinks
          factoryId={factoryId}
          projectRepositoryId={projectRepositoryId}
          reviewItem={item}
          threadId={threadId}
        />
      ) : null}
    </>
  );
}
