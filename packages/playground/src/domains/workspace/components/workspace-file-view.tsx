import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { Workspace } from '@mastra/playground-ui/domains/workspace';
import type { WorkspacePreviewFactory } from '@mastra/playground-ui/domains/workspace';
import { useWorkspaceContext } from '@mastra/playground-ui/domains/workspace/components/use-workspace-context';
import { WorkspaceAddSkill } from '@mastra/playground-ui/domains/workspace/components/workspace-add-skill';
import { is404NotFoundError } from '@mastra/react/hooks/query';
import { useWorkspaceDirectory } from '@mastra/react/hooks/workspace';

/** Retain the empty-workspace actions while the navigation stays available. */
export function WorkspaceFileView({ renderPreview }: { renderPreview?: WorkspacePreviewFactory }) {
  const { workspaceId, activeFilePath } = useWorkspaceContext();
  const { data, error } = useWorkspaceDirectory({ workspaceId, path: '.' });
  const isEmpty = data ? data.length === 0 : is404NotFoundError(error);
  if (isEmpty)
    return (
      <EmptyState
        variant="fill"
        titleSlot="This workspace is empty"
        descriptionSlot="Files written by your agents will show up here."
        actionSlot={
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Workspace.CreateDirectory labeled />
            <WorkspaceAddSkill labeled />
          </div>
        }
      />
    );
  return (
    <div className="flex h-full min-h-0 flex-col">
      {activeFilePath && (
        <Workspace.ActiveFileHeader>
          <Workspace.FilePath />
        </Workspace.ActiveFileHeader>
      )}
      <Workspace.ActiveFileContent renderPreview={renderPreview} />
    </div>
  );
}
