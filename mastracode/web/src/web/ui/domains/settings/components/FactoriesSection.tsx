import { Button } from '@mastra/playground-ui/components/Button';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { Trash2 } from 'lucide-react';

import { useRemoveFactoryMutation } from '../../../../../shared/hooks/useFactories';
import { isGithubFactory, useActiveFactoryContext } from '../../workspaces';
import { deriveProjectPath } from '../../../../../shared/hooks/useWorkspaces';

export function FactoriesSection() {
  const { factories } = useActiveFactoryContext();
  const removeMutation = useRemoveFactoryMutation();

  if (factories.length === 0) {
    return <Notice variant="info">No configured factories.</Notice>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <Txt variant="ui-lg" className="font-medium">
          Factories
        </Txt>
        <Txt variant="ui-sm">Remove local factories or disconnect GitHub repositories from the organization.</Txt>
      </div>

      {removeMutation.isError && (
        <Notice variant="destructive">
          {removeMutation.error instanceof Error ? removeMutation.error.message : 'Failed to remove factory'}
        </Notice>
      )}

      <div className="flex flex-col gap-2">
        {factories.map(factory => {
          const detail = isGithubFactory(factory)
            ? [factory.binding.gitBranch, factory.binding.sandboxWorkdir ?? 'Cloud sandbox'].filter(Boolean).join(' · ')
            : deriveProjectPath(factory);

          return (
            <div key={factory.id} className="flex items-center justify-between gap-4 py-2">
              <div className="min-w-0 flex flex-col">
                <Txt variant="ui-md" className="truncate font-medium">
                  {factory.name}
                </Txt>
                <Txt variant="ui-xs" className="truncate">
                  {detail}
                </Txt>
              </div>
              <Button
                size="xs"
                variant="ghost"
                disabled={removeMutation.isPending}
                aria-label={`Remove ${factory.name}`}
                onClick={() => removeMutation.mutate(factory.id)}
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
