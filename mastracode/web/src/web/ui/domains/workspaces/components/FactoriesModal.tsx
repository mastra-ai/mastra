import { Button } from '@mastra/playground-ui/components/Button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@mastra/playground-ui/components/Dialog';
import { Input } from '@mastra/playground-ui/components/Input';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useState } from 'react';

import { useAddFactoryMutation, useCreateFactoryMutation } from '../../../../../shared/hooks/useFactories';
import { useOverlays } from '../../../lib/overlays';
import { useActiveFactoryContext } from '../context/ActiveFactoryProvider';
import { DirectoryBrowser } from './DirectoryPicker';

function mutationError(error: unknown): string | null {
  if (!error) return null;
  return error instanceof Error ? error.message : String(error);
}

/**
 * Factory creation modal. The primary path is name-first: create a named
 * server-backed Factory project, then connect repositories from the Board or
 * Factory settings. Binding a local folder remains as a secondary path for
 * terminal-shared, org-less workflows.
 */
export function FactoriesModal() {
  const { close } = useOverlays();
  const { selectFactory } = useActiveFactoryContext();
  const createFactory = useCreateFactoryMutation();
  const addLocalFactory = useAddFactoryMutation();
  const [name, setName] = useState('');
  const [showFolderBrowser, setShowFolderBrowser] = useState(false);

  const createError = mutationError(createFactory.error);
  const localError = mutationError(addLocalFactory.error);

  const handleCreate = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      const factory = await createFactory.mutateAsync({ name: trimmed });
      await selectFactory(factory);
      close('factories');
    } catch {
      // Mutation state owns the rendered error.
    }
  };

  const handlePickFolder = async (path: string, folderName: string) => {
    try {
      const factory = await addLocalFactory.mutateAsync({ name: folderName || path, path });
      await selectFactory(factory);
      close('factories');
    } catch {
      // Mutation state owns the rendered error.
    }
  };

  return (
    <Dialog open onOpenChange={open => !open && close('factories')}>
      <DialogContent className="w-full max-w-lg" aria-label="Create Factory">
        <DialogHeader className="px-5 pt-4 pb-2">
          <DialogTitle>Create Factory</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3 px-5 pb-5">
          <form
            className="flex flex-col gap-3"
            onSubmit={event => {
              event.preventDefault();
              void handleCreate();
            }}
          >
            <div className="flex flex-col gap-1.5">
              <Txt as="label" htmlFor="factory-name" variant="ui-sm" className="text-icon4">
                Factory name
              </Txt>
              <Input
                id="factory-name"
                autoFocus
                value={name}
                onChange={event => setName(event.target.value)}
                placeholder="e.g. Mastra"
                disabled={createFactory.isPending}
              />
            </div>
            <Txt as="p" variant="ui-sm" className="text-icon3">
              A Factory owns its board, metrics, and audit trail. Connect repositories after creating it.
            </Txt>
            {createError && (
              <Txt as="div" variant="ui-sm" className="text-notice-destructive-fg">
                {createError}
              </Txt>
            )}
            <div className="flex items-center justify-end gap-2">
              <Button variant="ghost" size="sm" type="button" onClick={() => close('factories')}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" type="submit" disabled={!name.trim() || createFactory.isPending}>
                {createFactory.isPending ? 'Creating…' : 'Create Factory'}
              </Button>
            </div>
          </form>

          <div className="border-t border-border1 pt-3">
            <button
              type="button"
              className="text-ui-sm text-icon3 hover:text-icon5"
              onClick={() => setShowFolderBrowser(open => !open)}
            >
              {showFolderBrowser ? 'Hide local folder options' : 'Bind a local folder instead'}
            </button>
            {showFolderBrowser && (
              <div className="mt-3 flex flex-col gap-3">
                <Txt as="p" variant="ui-sm" className="text-icon3">
                  A local Factory binds to a directory on this machine so its threads, memory, and workspace stay scoped
                  there — and are shared with the terminal.
                </Txt>
                <DirectoryBrowser
                  onPick={(path, folderName) => void handlePickFolder(path, folderName)}
                  onCancel={() => setShowFolderBrowser(false)}
                  busy={addLocalFactory.isPending}
                  error={localError}
                />
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
