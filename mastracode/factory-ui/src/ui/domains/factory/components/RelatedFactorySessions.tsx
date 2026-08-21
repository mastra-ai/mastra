import { Button } from '@mastra/playground-ui/components/Button';
import { cn } from '@mastra/playground-ui/utils/cn';
import { Link2 } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router';

import { useUserSessionQuery, useWorkspacesQuery } from '../../../../hooks/useWorkspaces';
import { useWorkItemsQuery } from '../../../../hooks/useWorkItems';
import { ChatHeader } from '../../chat/components/ChatHeader';
import { WorkspaceFilesToggle } from '../../workspace-viewer/components/WorkspaceFilesToggle';
import { useWorkspacePanel } from '../../workspace-viewer/context/useWorkspacePanel';
import { relatedWorkItems, relationshipLabel, relationshipPath, workItemNumber } from '../services/relationships';
import type { WorkItem, WorkItemSessionRef } from '../services/workItems';
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
  if (item.source === 'github-issue' && number) return `Issue #${number}: ${item.title}`;
  return item.title;
}

function externalWorkItemLabel(item: WorkItem): string {
  const number = workItemNumber(item);
  if (item.source === 'github-pr') return number ? `PR #${number}` : 'Pull request';
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

export function FactorySessionHeader() {
  const { factoryId, sessionId, threadId } = useParams<{ factoryId: string; sessionId: string; threadId: string }>();
  const sessionQuery = useUserSessionQuery(sessionId);
  const projectRepositoryId = sessionQuery.data?.projectRepositoryId;
  const items = useWorkItemsQuery(factoryId);
  const workspaces = useWorkspacesQuery(projectRepositoryId);
  const { workspacePath } = useWorkspacePanel();

  const allItems = items.data ?? [];
  const currentItem = activeWorkItem(allItems, factoryId, sessionId, threadId);
  const hasSession = Boolean(currentItem || workspacePath);
  const livePaths = new Set((workspaces.data?.workspaces ?? []).map(workspace => workspace.sessionId));

  return (
    <ChatHeader className={cn(hasSession && 'border-border1 border-b md:px-5')}>
      {hasSession ? (
        <div role="region" aria-label="Factory session" className="flex min-w-0 flex-1 items-center gap-2">
          {currentItem ? <WorkItemBreadcrumb item={currentItem} factoryId={factoryId} /> : null}
          <div className="ml-auto flex shrink-0 items-center gap-1">
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
          </div>
        </div>
      ) : null}
    </ChatHeader>
  );
}

function WorkItemBreadcrumb({ item, factoryId }: { item: WorkItem; factoryId?: string }) {
  const isReview = item.source === 'github-pr';

  return (
    <nav className="text-ui-sm flex min-w-0 items-center gap-2" aria-label="Factory session breadcrumb">
      <Link
        to={isReview ? `/factories/${factoryId}/review` : `/factories/${factoryId}/work`}
        className="text-icon4 hover:text-icon6 shrink-0 font-medium hover:underline"
      >
        {isReview ? 'Review' : 'Work'}
      </Link>
      <span className="text-icon3" aria-hidden>
        /
      </span>
      <span className="text-icon6 truncate">{sessionTitle(item)}</span>
    </nav>
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
      {relatedWorkItems(item, allItems).map(related => {
        const label = relationshipLabel(related);
        const session = latestLiveSession(related, livePaths);

        if (!session) {
          return (
            <Link
              key={related.id}
              to={relationshipPath(related, factoryId)}
              className="text-ui-sm text-icon4 hover:bg-surface3 hover:text-icon6 flex items-center gap-1.5 rounded-md px-2 py-1"
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
      {item.source === 'github-pr' ? (
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
