import { Button } from '@mastra/playground-ui/components/Button';
import { Link2 } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router';

import {
  deriveProjectPath,
  useSelectWorkspaceMutation,
  useWorkspacesQuery,
} from '../../../../../shared/hooks/useWorkspaces';
import { useFactoryBasePath } from '../../../../../shared/hooks/useFactoryBasePath';
import { useWorkItemsQuery } from '../../../../../shared/hooks/useWorkItems';
import { AGENT_CONTROLLER_ID } from '../../chat/services/constants';
import { isServerFactory, useActiveFactoryContext } from '../../workspaces';
import { relatedWorkItems, relationshipLabel, relationshipPath } from '../services/relationships';
import type { WorkItem, WorkItemSessionRef } from '../services/workItems';

function latestLiveSession(item: WorkItem, livePaths: ReadonlySet<string>): WorkItemSessionRef | undefined {
  return Object.values(item.sessions)
    .filter(session => livePaths.has(session.projectPath))
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

export function FactorySessionHeader() {
  const { activeFactory } = useActiveFactoryContext();
  const { threadId } = useParams();
  const navigate = useNavigate();
  const basePath = useFactoryBasePath();
  const factoryProjectId =
    activeFactory && isServerFactory(activeFactory) ? activeFactory.binding.factoryProjectId : undefined;
  const items = useWorkItemsQuery(factoryProjectId);
  const workspaces = useWorkspacesQuery(activeFactory);
  const selectWorkspace = useSelectWorkspaceMutation(activeFactory, {
    agentControllerId: AGENT_CONTROLLER_ID,
    resourceId: activeFactory?.resourceId,
  });

  if (!threadId || !factoryProjectId) return null;

  const allItems = items.data ?? [];
  const activeProjectPath = deriveProjectPath(activeFactory);
  const currentItem = allItems.find(item =>
    Object.values(item.sessions).some(
      session => session.threadId === threadId && (!activeProjectPath || session.projectPath === activeProjectPath),
    ),
  );
  if (!currentItem) return null;

  const relatedItems = relatedWorkItems(currentItem, allItems);
  const livePaths = new Set((workspaces.data?.worktrees ?? []).map(worktree => worktree.worktreePath));
  const destinations = relatedItems.map(item => ({ item, session: latestLiveSession(item, livePaths) }));
  const isReview = currentItem.source === 'github-pr';
  const section = isReview ? 'Review' : 'Work';
  const sectionPath = `${basePath.base}${isReview ? '/review' : '/work'}`;

  const openSession = async (session: WorkItemSessionRef) => {
    await selectWorkspace.mutateAsync(session.projectPath);
    void navigate(basePath.thread(session.threadId));
  };

  return (
    <header role="region" className="border-b border-border1 px-3 py-2.5 md:px-5" aria-label="Factory session">
      <div className="flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <nav className="flex min-w-0 items-center gap-2 text-ui-sm" aria-label="Factory session breadcrumb">
          <Link to={sectionPath} className="shrink-0 font-medium text-icon4 hover:text-icon6 hover:underline">
            {section}
          </Link>
          <span className="text-icon3" aria-hidden>
            /
          </span>
          <span className="truncate text-icon6">{sessionTitle(currentItem)}</span>
        </nav>
        {destinations.length > 0 ? (
          <div className="flex shrink-0 flex-wrap items-center gap-1">
            {destinations.map(({ item, session }) => {
              const label = relationshipLabel(item);
              if (!session) {
                return (
                  <Link
                    key={item.id}
                    to={`${basePath.base}${relationshipPath(item)}`}
                    className="flex items-center gap-1.5 rounded-md px-2 py-1 text-ui-sm text-icon4 hover:bg-surface3 hover:text-icon6"
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
                  disabled={selectWorkspace.isPending}
                  onClick={() => void openSession(session)}
                >
                  <Link2 size={13} aria-hidden />
                  {label}
                </Button>
              );
            })}
          </div>
        ) : null}
      </div>
    </header>
  );
}
