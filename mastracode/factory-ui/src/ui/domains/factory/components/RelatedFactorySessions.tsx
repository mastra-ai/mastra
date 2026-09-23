import { Crumb } from '@mastra/playground-ui/components/Breadcrumb';
import { Button } from '@mastra/playground-ui/components/Button';
import { Link2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link, useMatch, useNavigate, useParams } from 'react-router';

import { useUserSessionQuery, useWorkspacesQuery } from '../../../../hooks/useWorkspaces';
import { useWorkItemsQuery } from '../../../../hooks/useWorkItems';
import { ChatPageLayout } from '../../chat/components/ChatPageLayout';
import { getUserSessionLabel } from '../../workspaces/services/sessionPresentation';
import { WorkspaceFilesToggle } from '../../workspace-viewer/components/WorkspaceFilesToggle';
import { relatedWorkItemIndex, relationshipLabel, relationshipPath, workItemNumber } from '../services/relationships';
import type { WorkItem, WorkItemSessionRef } from '../services/workItems';
import { isPullRequestSource } from '../services/workItems';
import { genericExternalWorkItemUrl } from '../services/workItemPresentation';
import { SourceIcon } from './BoardIcons';
import { FactoryReviewPullRequestLinks } from './FactoryReviewPullRequestLinks';

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
    return typeof item.metadata.identifier === 'string' ? item.metadata.identifier : (number ?? 'Linear issue');
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

/** Chat page frame for a factory thread: breadcrumb of the work item or session, plus its actions. */
export function FactorySessionPage({ children }: { children: ReactNode }) {
  const { factoryId, sessionId, threadId } = useParams<{ factoryId: string; sessionId: string; threadId: string }>();
  // User threads carry the session id as `threadId` (see ChatSessionProvider).
  const isUserThread = Boolean(useMatch('/factories/:factoryId/user/threads/:threadId'));
  const userSessionId = sessionId ?? threadId;
  const sessionQuery = useUserSessionQuery(userSessionId);
  const projectRepositoryId = sessionQuery.data?.projectRepositoryId;
  const items = useWorkItemsQuery(factoryId);
  const workspaces = useWorkspacesQuery(projectRepositoryId);

  const allItems = items.data ?? [];
  const currentItem = activeWorkItem(allItems, factoryId, sessionId, threadId);
  // Prefer the list row: PageTitle patches it with the generated title, the detail cache is not updated.
  const session = workspaces.data?.userSessions.find(entry => entry.sessionId === userSessionId) ?? sessionQuery.data;
  const workspaceTitle = !isUserThread && !currentItem ? session?.title?.trim() : undefined;
  const livePaths = new Set((workspaces.data?.workspaces ?? []).map(workspace => workspace.sessionId));
  const isReview = currentItem ? isPullRequestSource(currentItem.source) : false;

  const crumbs = currentItem ? (
    <>
      <Crumb as={Link} to={`/factories/${factoryId}/${isReview ? 'review' : 'work'}`}>
        {isReview ? 'Review' : 'Work'}
      </Crumb>
      <Crumb as="span" isCurrent>
        {sessionTitle(currentItem)}
      </Crumb>
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
  const navigate = useNavigate();
  const externalItemUrl = genericExternalWorkItemUrl(item);
  const externalItemLabel = externalWorkItemLabel(item);

  const openSession = (session: WorkItemSessionRef) => {
    void navigate(`/factories/${factoryId}/workspaces/${session.sessionId}/threads/${session.threadId}`);
  };

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
              key={related.id}
              to={relationshipPath(related, factoryId)}
              className="text-caption text-muted-foreground hover:bg-fill hover:text-foreground flex items-center gap-1.5 rounded-md px-2 py-1"
              aria-label={`Open ${label}: ${related.title}`}
            >
              <Link2 size={13} aria-hidden />
              {label}
            </Link>
          );
        }

        return (
          <Button
            key={related.id}
            type="button"
            variant="ghost"
            size="sm"
            aria-label={`Open ${label}: ${related.title}`}
            onClick={() => openSession(session)}
          >
            <Link2 size={13} aria-hidden />
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
