import { Button } from '@mastra/playground-ui/components/Button';
import { Input } from '@mastra/playground-ui/components/Input';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useState } from 'react';
import { useNavigate } from 'react-router';

import { useCreateFactoryMutation } from '../../../../../shared/hooks/useFactories';
import { useKeyDown } from '../../../lib/hooks';

function mutationError(error: unknown): string | null {
  if (!error) return null;
  return error instanceof Error ? error.message : String(error);
}

/**
 * Factory creation surface (rendered on the `/factories/create` page). The
 * flow is name-first: create a server-backed Factory project, then connect
 * repositories from the Board or Factory settings.
 */
export function FactoriesPanel({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const createFactory = useCreateFactoryMutation();
  const [name, setName] = useState('');

  const createError = mutationError(createFactory.error);

  useKeyDown({ escape: onClose });

  const handleCreate = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      const factory = await createFactory.mutateAsync({ name: trimmed });
      void navigate(`/factories/${factory.id}`);
    } catch {
      // Mutation state owns the rendered error.
    }
  };

  return (
    <section aria-labelledby="create-factory-title" className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">
        <div className="mx-auto flex min-h-full w-full max-w-4xl flex-col py-3">
          <div className="mt-6 mb-6 flex items-center">
            <Txt as="h1" variant="header-sm" id="create-factory-title" tabIndex={-1} className="text-icon6">
              Create Factory
            </Txt>
          </div>
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
        </div>
      </div>
    </section>
  );
}
