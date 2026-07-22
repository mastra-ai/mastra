import { Button } from '@mastra/playground-ui/components/Button';
import { Input } from '@mastra/playground-ui/components/Input';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useState } from 'react';
import { useNavigate } from 'react-router';

import { useAddFactoryMutation, useCreateFactoryMutation } from '../../../../../shared/hooks/useFactories';
import { useKeyDown } from '../../../lib/hooks';
import { CloseIcon } from '../../../ui/icons';
import { DirectoryBrowser } from './DirectoryPicker';

function mutationError(error: unknown): string | null {
  if (!error) return null;
  return error instanceof Error ? error.message : String(error);
}

/**
 * Factory creation surface (rendered on the `/factories/create` page). The
 * primary path is name-first: create a server-backed Factory project, then
 * connect repositories from the Board or Factory settings. Binding a local
 * folder remains a secondary path for terminal-shared, org-less workflows.
 */
export function FactoriesPanel({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const createFactory = useCreateFactoryMutation();
  const addLocalFactory = useAddFactoryMutation();
  const [name, setName] = useState('');
  const [showFolderBrowser, setShowFolderBrowser] = useState(false);

  const createError = mutationError(createFactory.error);
  const localError = mutationError(addLocalFactory.error);

  useKeyDown({ escape: onClose });

  const handleCreate = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      const factory = await createFactory.mutateAsync({ name: trimmed });
      // The factory is brand new, so build its URL directly (the route param
      // still points at the previous factory, if any).
      void navigate(`/factories/${factory.id}/work`);
    } catch {
      // Mutation state owns the rendered error.
    }
  };

  const handlePickFolder = async (path: string, folderName: string) => {
    try {
      const factory = await addLocalFactory.mutateAsync({ name: folderName || path, path });
      void navigate(`/factories/${factory.id}/new`);
    } catch {
      // Mutation state owns the rendered error.
    }
  };

  return (
    <section aria-labelledby="create-factory-title" className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border1 px-5 py-4">
        <Txt as="h1" variant="header-sm" id="create-factory-title" className="text-icon6">
          Create Factory
        </Txt>
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Close factory creation" onClick={onClose}>
          <CloseIcon size={16} />
        </Button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">
        <div className="mx-auto flex min-h-full w-full max-w-4xl flex-col py-5">
          <form
            className="flex w-full max-w-lg flex-col gap-3"
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
              <Button variant="ghost" size="sm" type="button" onClick={onClose}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" type="submit" disabled={!name.trim() || createFactory.isPending}>
                {createFactory.isPending ? 'Creating…' : 'Create Factory'}
              </Button>
            </div>
          </form>

          <div className="mt-5 flex min-h-0 flex-1 flex-col border-t border-border1 pt-4">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-fit"
              onClick={() => setShowFolderBrowser(open => !open)}
            >
              {showFolderBrowser ? 'Hide local folder options' : 'Bind a local folder instead'}
            </Button>
            {showFolderBrowser && (
              <div className="mt-4 flex min-h-80 flex-1 flex-col gap-3">
                <Txt as="p" variant="ui-sm" className="max-w-2xl text-icon3">
                  A local Factory binds to a directory on this machine so its threads, memory, and workspace stay scoped
                  there — and are shared with the terminal.
                </Txt>
                <DirectoryBrowser
                  onPick={(path, folderName) => void handlePickFolder(path, folderName)}
                  busy={addLocalFactory.isPending}
                  error={localError}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
