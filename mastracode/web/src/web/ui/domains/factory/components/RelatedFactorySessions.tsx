import { Button } from '@mastra/playground-ui/components/Button';
import { Link2 } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router';

import {
  deriveProjectPath,
  useSelectWorkspaceMutation,
  useWorkspacesQuery,
} from '../../../../../shared/hooks/useWorkspaces';
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

export function RelatedFactorySessions() {
  const { activeFactory } = useActiveFactoryContext();
  const { threadId } = useParams();
  const navigate = useNavigate();
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
  if (destinations.length === 0) return null;

  const openSession = async (session: WorkItemSessionRef) => {
    await selectWorkspace.mutateAsync(session.projectPath);
    void navigate(`/threads/${session.threadId}`);
  };

  return (
    <div className="flex flex-wrap items-center gap-2 px-3 pt-3 md:px-5" aria-label="Related Factory sessions">
      {destinations.map(({ item, session }) => {
        const label = relationshipLabel(item);
        if (!session) {
          return (
            <Link
              key={item.id}
              to={relationshipPath(item)}
              className="flex items-center gap-1.5 rounded-md px-2 py-1 text-ui-sm text-accent2 hover:bg-surface3"
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
  );
}
