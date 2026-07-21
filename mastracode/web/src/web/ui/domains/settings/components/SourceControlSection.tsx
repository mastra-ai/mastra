import { Button } from '@mastra/playground-ui/components/Button';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { Trash2 } from 'lucide-react';

import { useRemoveFactoryMutation } from '../../../../../shared/hooks/useFactories';
import { deriveProjectPath } from '../../../../../shared/hooks/useWorkspaces';
import { ConnectRepositoriesPanel, isServerFactory, useActiveFactoryContext } from '../../workspaces';

/**
 * Settings › Source Control. Scoped to the factory the user is actively in:
 * repository linking for server-backed Factories, plus removal of the active
 * factory itself. Local folder factories have no source-control surface, so
 * they only get the binding detail and remove action.
 */
export function SourceControlSection() {
  const { activeFactory } = useActiveFactoryContext();
  const removeMutation = useRemoveFactoryMutation();

  if (!activeFactory) {
    return <Notice variant="info">Select a factory to manage its source control.</Notice>;
  }

  const serverFactory = isServerFactory(activeFactory) ? activeFactory : undefined;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <Txt variant="ui-lg" className="font-medium">
          Source Control
        </Txt>
        <Txt variant="ui-sm">
          {serverFactory
            ? `Link the repositories ${activeFactory.name} works on. Intake, sessions, and worktrees are scoped per repository.`
            : `${activeFactory.name} is bound to a local folder — repository linking is available for server-backed Factories.`}
        </Txt>
      </div>

      {serverFactory ? (
        <ConnectRepositoriesPanel factory={serverFactory} />
      ) : (
        <Txt variant="ui-sm" className="truncate text-icon3">
          {deriveProjectPath(activeFactory)}
        </Txt>
      )}

      <div className="flex items-center justify-between gap-4 border-t border-border1 pt-4">
        <div className="min-w-0 flex flex-col">
          <Txt variant="ui-md" className="truncate font-medium">
            Remove {activeFactory.name}
          </Txt>
          <Txt variant="ui-xs">
            {serverFactory
              ? 'Deletes this Factory from the organization, including its repository links.'
              : 'Removes this factory from this browser. The local folder is untouched.'}
          </Txt>
        </div>
        <Button
          size="xs"
          variant="ghost"
          disabled={removeMutation.isPending}
          aria-label={`Remove ${activeFactory.name}`}
          onClick={() => removeMutation.mutate(activeFactory.id)}
        >
          <Trash2 size={14} />
          Remove
        </Button>
      </div>

      {removeMutation.isError && (
        <Notice variant="destructive">
          {removeMutation.error instanceof Error ? removeMutation.error.message : 'Failed to remove factory'}
        </Notice>
      )}
    </div>
  );
}
