import { Button } from '@mastra/playground-ui/components/Button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@mastra/playground-ui/components/Dialog';
import { Txt } from '@mastra/playground-ui/components/Txt';

import { useAddProjectMutation } from '../../../../../shared/hooks/useProjects';
import { useOverlays } from '../../../lib/overlays';
import { useActiveProjectContext } from '../context/ActiveProjectProvider';
import { DirectoryBrowser } from './DirectoryPicker';

interface ProjectsModalProps {
  onOpenGithub?: () => void;
}

/** Dedicated local-folder picker. Project selection and removal live elsewhere. */
export function ProjectsModal({ onOpenGithub }: ProjectsModalProps) {
  const { close } = useOverlays();
  const { selectProject } = useActiveProjectContext();
  const addProject = useAddProjectMutation();
  const error =
    addProject.error instanceof Error ? addProject.error.message : addProject.error ? String(addProject.error) : null;

  const handlePick = async (path: string, name: string) => {
    try {
      const project = await addProject.mutateAsync({ name: name || path, path });
      await selectProject(project);
      close('projects');
    } catch {
      // Mutation state owns the rendered error.
    }
  };

  return (
    <Dialog open onOpenChange={open => !open && close('projects')}>
      <DialogContent className="w-full max-w-lg" aria-label="Open local project">
        <DialogHeader className="px-5 pt-4 pb-2">
          <DialogTitle>Open a project</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3 px-5 pb-5">
          <Txt as="p" variant="ui-sm" className="text-icon3">
            Choose a folder on this machine. Its threads, memory, and workspace stay scoped to that directory — and are
            shared with the terminal.
          </Txt>
          {onOpenGithub ? (
            <Button type="button" variant="outline" size="sm" onClick={onOpenGithub}>
              Open from GitHub
            </Button>
          ) : null}
          <DirectoryBrowser
            onPick={(path, name) => void handlePick(path, name)}
            onCancel={() => close('projects')}
            busy={addProject.isPending}
            error={error}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
