import { Button } from '@mastra/playground-ui/components/Button';
import { Link2 } from 'lucide-react';
import { useNavigate, useParams } from 'react-router';

import { useSelectWorkspaceMutation, useWorkspacesQuery } from '../../../../../shared/hooks/useWorkspaces';
import { useWorkItemsQuery } from '../../../../../shared/hooks/useWorkItems';
import { AGENT_CONTROLLER_ID } from '../../chat/services/constants';
import { useActiveProjectContext } from '../../workspaces';
import type { WorkItem, WorkItemSessionRef } from '../services/workItems';

function latestLiveSession(item: WorkItem, livePaths: ReadonlySet<string>): WorkItemSessionRef | undefined {
  return Object.values(item.sessions)
    .filter(session => livePaths.has(session.projectPath))
    .at(-1);
}

export function RelatedFactorySessions() {
  const { activeProject } = useActiveProjectContext();
  const { threadId } = useParams();
  const navigate = useNavigate();
  const githubProjectId = activeProject?.source === 'github' ? activeProject.githubProjectId : undefined;
  const items = useWorkItemsQuery(githubProjectId);
  const workspaces = useWorkspacesQuery(activeProject);
  const selectWorkspace = useSelectWorkspaceMutation(activeProject, {
    agentControllerId: AGENT_CONTROLLER_ID,
    resourceId: activeProject?.resourceId,
  });

  if (!threadId || !githubProjectId) return null;

  const allItems = items.data ?? [];
  const currentItem = allItems.find(item =>
    Object.values(item.sessions).some(session => session.threadId === threadId),
  );
  if (!currentItem) return null;

  const relatedItems = allItems.filter(
    item => item.id === currentItem.parentWorkItemId || item.parentWorkItemId === currentItem.id,
  );
  const livePaths = new Set((workspaces.data?.worktrees ?? []).map(worktree => worktree.worktreePath));
  const destinations = relatedItems.flatMap(item => {
    const session = latestLiveSession(item, livePaths);
    return session ? [{ item, session }] : [];
  });
  if (destinations.length === 0) return null;

  const openSession = async (session: WorkItemSessionRef) => {
    await selectWorkspace.mutateAsync(session.projectPath);
    void navigate(`/threads/${session.threadId}`);
  };

  return (
    <div className="flex flex-wrap items-center gap-2 px-3 pt-3 md:px-5" aria-label="Related Factory sessions">
      {destinations.map(({ item, session }) => (
        <Button
          key={item.id}
          type="button"
          variant="ghost"
          size="sm"
          aria-label={`Open related ${item.source === 'github-pr' ? 'review' : 'work'} session: ${item.title}`}
          disabled={selectWorkspace.isPending}
          onClick={() => void openSession(session)}
        >
          <Link2 size={13} aria-hidden />
          Open related {item.source === 'github-pr' ? 'review' : 'work'} session
        </Button>
      ))}
    </div>
  );
}
