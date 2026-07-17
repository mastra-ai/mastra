import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@mastra/playground-ui/components/Dialog';
import { Txt } from '@mastra/playground-ui/components/Txt';

import { useAddFactoryMutation } from '../../../../../shared/hooks/useFactories';
import { useOverlays } from '../../../lib/overlays';
import { useActiveFactoryContext } from '../context/ActiveFactoryProvider';
import { DirectoryBrowser } from './DirectoryPicker';

/** Dedicated local-folder picker. Project selection and removal live elsewhere. */
export function ProjectsModal() {
  const { close } = useOverlays();
  const { selectFactory } = useActiveFactoryContext();
  const addLocalFactory = useAddFactoryMutation();
  const error =
    addLocalFactory.error instanceof Error ? addLocalFactory.error.message : addLocalFactory.error ? String(addLocalFactory.error) : null;

  const handlePick = async (path: string, name: string) => {
    try {
      const project = await addLocalFactory.mutateAsync({ name: name || path, path });
      await selectFactory(project);
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
          <DirectoryBrowser
            onPick={(path, name) => void handlePick(path, name)}
            onCancel={() => close('projects')}
            busy={addLocalFactory.isPending}
            error={error}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
