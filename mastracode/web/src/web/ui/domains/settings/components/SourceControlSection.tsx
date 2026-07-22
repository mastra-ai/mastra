import { Button } from '@mastra/playground-ui/components/Button';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { Trash2 } from 'lucide-react';
import { useParams } from 'react-router';

import { useFactoryQuery, useRemoveFactoryMutation } from '../../../../../shared/hooks/useFactories';
import { ConnectRepositoriesPanel } from '../../workspaces';
import { UserGithubConnectionRow } from './UserGithubConnectionRow';

/**
 * Settings › Source Control. Scoped to the factory the user is actively in:
 * repository linking for server-backed Factories, plus removal of the active
 * factory itself. Local folder factories have no source-control surface, so
 * they only get the binding detail and remove action.
 */
export function SourceControlSection() {
  const { factoryId } = useParams<{ factoryId: string }>();
  const factoryQuery = useFactoryQuery(factoryId);
  const activeFactory = factoryQuery.data;
  const removeMutation = useRemoveFactoryMutation();

  if (!activeFactory) {
    return <Notice variant="info">Select a factory to manage its source control.</Notice>;
  }

  return (
    <div className="flex flex-col gap-4">
      <Txt variant="ui-sm">
        {`Link the repositories ${activeFactory.name} works on. Intake, sessions, and workspaces are scoped per repository.`}
      </Txt>

      <ConnectRepositoriesPanel factory={activeFactory} />
      <UserGithubConnectionRow />

      <div className="flex items-center justify-between gap-4 border-t border-border1 pt-4">
        <div className="min-w-0 flex flex-col">
          <Txt variant="ui-md" className="truncate font-medium">
            Remove {activeFactory.name}
          </Txt>
          <Txt variant="ui-xs">Deletes this Factory from the organization, including its repository links.</Txt>
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
