import { Notice } from '@mastra/playground-ui/components/Notice';
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { toast } from '@mastra/playground-ui/components/Toaster';
import { useState } from 'react';
import { Link, useParams } from 'react-router';

import { useFactoryQuery } from '../../../../hooks/useFactories';
import { useFactoryEnvironmentQuery, useSaveFactoryEnvironmentMutation } from '../../../../hooks/useFactoryEnvironment';
import type { FactoryEnvironmentPatch, FactoryEnvironmentPayload } from '../../workspaces/services/environment';
import { settingsSectionPath } from '../settingsSections';
import { RepositoriesBlock } from './environment/RepositoriesBlock';
import { ResourcesBlock } from './environment/ResourcesBlock';
import { WorkspaceSetupBlock } from './environment/WorkspaceSetupBlock';
import { SettingsSubsection } from './SettingsSubsection';

/**
 * The Factory's environment: what every session's sandbox boots from. Resources,
 * the ordered repositories with their setup, the workspace setup command, the
 * build triggers and the last build's status all live here.
 */
export function EnvironmentSection() {
  const { factoryId } = useParams<{ factoryId: string }>();
  const factoryQuery = useFactoryQuery(factoryId);
  const environmentQuery = useFactoryEnvironmentQuery(factoryId);
  const factory = factoryQuery.data;

  if (!factoryId || (factoryQuery.isSuccess && !factory)) {
    return <Notice variant="info">Select a factory to manage its environment.</Notice>;
  }

  return (
    <div className="flex min-w-0 flex-col gap-8">
      <SettingsSubsection
        scope="factory"
        title="Environment"
        description={
          factory
            ? `What every ${factory.name} session boots from: the sandbox, its repositories and how the template is rebuilt.`
            : undefined
        }
      >
        {environmentQuery.isError ? (
          <Notice variant="destructive">
            {environmentQuery.error instanceof Error ? environmentQuery.error.message : 'Failed to load environment'}
          </Notice>
        ) : environmentQuery.data ? (
          <EnvironmentBlocks factoryId={factoryId} environment={environmentQuery.data} />
        ) : (
          <Skeleton className="h-24 w-full" />
        )}
      </SettingsSubsection>
    </div>
  );
}

function EnvironmentBlocks({ factoryId, environment }: { factoryId: string; environment: FactoryEnvironmentPayload }) {
  const saveMutation = useSaveFactoryEnvironmentMutation();
  const [buildRequested, setBuildRequested] = useState(false);

  if (environment.repositories.length === 0) {
    return (
      <Notice variant="info">
        Link a repository first.{' '}
        <Link to={settingsSectionPath(factoryId, 'repositories')} className="underline">
          Go to Repositories
        </Link>
      </Notice>
    );
  }

  const save = (input: FactoryEnvironmentPatch) =>
    saveMutation.mutateAsync(
      { factoryId, input },
      {
        onSuccess: saved => {
          if (saved.buildRequested) setBuildRequested(true);
          toast.success('Environment saved');
        },
        onError: err => toast.error(err instanceof Error ? err.message : 'Failed to save environment'),
      },
    );

  return (
    <div className="flex flex-col gap-8">
      {buildRequested && <Notice variant="info">Changes to the environment start a new build.</Notice>}
      <ResourcesBlock environment={environment} disabled={saveMutation.isPending} onSave={save} />
      <RepositoriesBlock repositories={environment.repositories} disabled={saveMutation.isPending} onSave={save} />
      <WorkspaceSetupBlock value={environment.workspaceSetupCommand} disabled={saveMutation.isPending} onSave={save} />
    </div>
  );
}
