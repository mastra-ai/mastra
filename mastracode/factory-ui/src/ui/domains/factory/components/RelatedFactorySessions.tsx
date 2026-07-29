import { Button } from '@mastra/playground-ui/components/Button';
import { ExternalLink, Link2 } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router';

import { useUserSessionQuery, useWorkspacesQuery } from '../../../../hooks/useWorkspaces';
import { useWorkItemsQuery } from '../../../../hooks/useWorkItems';
import { relatedWorkItems, relationshipLabel, relationshipPath } from '../services/relationships';
import type { WorkItem, WorkItemSessionRef } from '../services/workItems';
import { genericExternalWorkItemUrl } from '../services/workItemPresentation';
import { FactoryReviewPullRequestLinks } from './FactoryReviewPullRequestLinks';

function latestLiveSession(item: WorkItem, livePaths: ReadonlySet<string>): WorkItemSessionRef | undefined {
  return Object.values(item.sessions)
    .filter(session => livePaths.has(session.sessionId))
    .at(-1);
}

function itemNumber(item: WorkItem): string | undefined {
  const number = item.metadata.number;
  if (typeof number === 'number' || typeof number === 'string') return String(number);
  return item.sourceKey?.split(':').at(-1) || undefined;
}

function sessionTitle(item: WorkItem): string {
  const number = itemNumber(item);
  if (item.source === 'github-pr' && number) return `PR #${number}: ${item.title}`;
  if (item.source === 'github-issue' && number) return `Issue #${number}: ${item.title}`;
  return item.title;
}

function externalWorkItemLabel(item: WorkItem): string {
  const number = itemNumber(item);
  if (item.source === 'github-pr') return number ? `PR #${number}` : 'Pull request';
  if (item.source === 'github-issue') return number ? `Issue #${number}` : 'Issue';
  if (item.source === 'linear-issue') {
    return typeof item.metadata.identifier === 'string' ? item.metadata.identifier : (number ?? 'Linear issue');
  }
  return 'Work item';
}

export function FactorySessionHeader() {
  const { factoryId, sessionId, threadId } = useParams<{ factoryId: string; sessionId: string; threadId: string }>();
  const navigate = useNavigate();
  const sessionQuery = useUserSessionQuery(sessionId);
  const projectRepositoryId = sessionQuery.data?.projectRepositoryId;
  const items = useWorkItemsQuery(factoryId);
  const workspaces = useWorkspacesQuery(projectRepositoryId);

  if (!threadId || !factoryId || !sessionId) return null;

  const allItems = items.data ?? [];
  const activeProjectPath = sessionId;
  const currentItem = allItems.find(item =>
    Object.values(item.sessions).some(
      session => session.threadId === threadId && (!activeProjectPath || session.sessionId === activeProjectPath),
    ),
  );
  if (!currentItem) return null;

  const relatedItems = relatedWorkItems(currentItem, allItems);
  const livePaths = new Set((workspaces.data?.workspaces ?? []).map(workspace => workspace.sessionId));
  const destinations = relatedItems.map(item => ({ item, session: latestLiveSession(item, livePaths) }));
  const isReview = currentItem.source === 'github-pr';
  const section = isReview ? 'Review' : 'Work';
  const sectionPath = isReview ? `/factories/${factoryId}/review` : `/factories/${factoryId}/work`;
  const externalItemUrl = genericExternalWorkItemUrl(currentItem);
  const externalItemLabel = externalWorkItemLabel(currentItem);
  const hasHeaderActions = Boolean(externalItemUrl) || destinations.length > 0;

  const openSession = (session: WorkItemSessionRef) => {
    void navigate(`/factories/${factoryId}/workspaces/${session.sessionId}/threads/${session.threadId}`);
  };

  return (
    <header role="region" className="border-border1 border-b px-3 py-2.5 md:px-5" aria-label="Factory session">
      <div className="flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <nav className="text-ui-sm flex min-w-0 items-center gap-2" aria-label="Factory session breadcrumb">
          <Link to={sectionPath} className="text-icon4 hover:text-icon6 shrink-0 font-medium hover:underline">
            {section}
          </Link>
          <span className="text-icon3" aria-hidden>
            /
          </span>
          <span className="text-icon6 truncate">{sessionTitle(currentItem)}</span>
        </nav>
        {hasHeaderActions || isReview ? (
          <div className="flex shrink-0 flex-wrap items-center gap-1">
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
                <ExternalLink size={13} aria-hidden />
                {externalItemLabel}
              </Button>
            ) : null}
            {destinations.map(({ item, session }) => {
              const label = relationshipLabel(item);
              if (!session) {
                return (
                  <Link
                    key={item.id}
                    to={relationshipPath(item, factoryId)}
                    className="text-ui-sm text-icon4 hover:bg-surface3 hover:text-icon6 flex items-center gap-1.5 rounded-md px-2 py-1"
                    aria-label={`Open ${label}: ${item.title}`}
                  >
                    <Link2 size={13} aria-hidden />
                    {label}
                  </Link>
                );
              }
              return (
                <Button
                  key={item.id}
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label={`Open ${label}: ${item.title}`}
                  onClick={() => openSession(session)}
                >
                  <Link2 size={13} aria-hidden />
                  {label}
                </Button>
              );
            })}
            {isReview ? (
              <FactoryReviewPullRequestLinks
                factoryId={factoryId}
                projectRepositoryId={projectRepositoryId}
                reviewItem={currentItem}
                threadId={threadId}
              />
            ) : null}
          </div>
        ) : null}
      </div>
    </header>
  );
}
