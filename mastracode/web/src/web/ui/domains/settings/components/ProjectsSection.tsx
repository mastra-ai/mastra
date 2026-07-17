import { Button } from '@mastra/playground-ui/components/Button';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { Trash2 } from 'lucide-react';

import { useRemoveProjectMutation } from '../../../../../shared/hooks/useProjects';
import { useActiveProjectContext } from '../../workspaces';
import { deriveProjectPath } from '../../../../../shared/hooks/useWorkspaces';

export function ProjectsSection() {
  const { projects } = useActiveProjectContext();
  const removeMutation = useRemoveProjectMutation();

  if (projects.length === 0) {
    return <Notice variant="info">No configured projects.</Notice>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <Txt variant="ui-lg" className="font-medium">
          Projects
        </Txt>
        <Txt variant="ui-sm">Remove local folders and GitHub repositories from Mastra Code.</Txt>
      </div>

      {removeMutation.isError && (
        <Notice variant="destructive">
          {removeMutation.error instanceof Error ? removeMutation.error.message : 'Failed to remove project'}
        </Notice>
      )}

      <div className="flex flex-col gap-2">
        {projects.map(project => {
          const detail =
            project.source === 'github'
              ? [project.gitBranch, project.sandboxWorkdir ?? 'Cloud sandbox'].filter(Boolean).join(' · ')
              : deriveProjectPath(project);

          return (
            <div key={project.id} className="flex items-center justify-between gap-4 py-2">
              <div className="min-w-0 flex flex-col">
                <Txt variant="ui-md" className="truncate font-medium">
                  {project.name}
                </Txt>
                <Txt variant="ui-xs" className="truncate">
                  {detail}
                </Txt>
              </div>
              <Button
                size="xs"
                variant="ghost"
                disabled={removeMutation.isPending}
                aria-label={`Remove ${project.name}`}
                onClick={() => removeMutation.mutate(project.id)}
              >
                <Trash2 size={14} />
                Remove
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
