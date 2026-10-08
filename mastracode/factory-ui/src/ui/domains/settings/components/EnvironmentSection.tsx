import { Notice } from '@mastra/playground-ui/components/Notice';
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { toast } from '@mastra/playground-ui/components/Toaster';
import { Link, useParams } from 'react-router';

import { useFactoryQuery } from '../../../../hooks/useFactories';
import { useFactoryEnvironmentQuery, useSaveFactoryEnvironmentMutation } from '../../../../hooks/useFactoryEnvironment';
import type { FactoryEnvironmentPatch, FactoryEnvironmentPayload } from '../../workspaces/services/environment';
import { settingsSectionPath } from '../settingsSections';
import { RepositoriesBlock, type RepositoryProviders } from './environment/RepositoriesBlock';
import { ResourcesBlock } from './environment/ResourcesBlock';
import { WorkspaceSetupBlock } from './environment/WorkspaceSetupBlock';
import { SettingsSubsection } from './SettingsSubsection';

/**
 * The Factory's environment: what every session's sandbox boots from. Resources,
 * the ordered repositories with their setup and the workspace setup command
 * all live here.
 */
export function EnvironmentSection() {
  const { factoryId } = useParams<{ factoryId: string }>();
  const factoryQuery = useFactoryQuery(factoryId);
  const environmentQuery = useFactoryEnvironmentQuery(factoryId);
  const factory = factoryQuery.data;
  // The environment payload carries no provider; the factory's link list does.
  const providers: RepositoryProviders = Object.fromEntries(
    (factory?.repositories ?? []).map(repository => [repository.projectRepositoryId, repository.provider ?? 'github']),
  );

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
            ? `What every ${factory.name} session boots from: the sandbox, its repositories and their setup.`
            : undefined
        }
      >
        {environmentQuery.isError ? (
          <Notice variant="destructive">
            {environmentQuery.error instanceof Error ? environmentQuery.error.message : 'Failed to load environment'}
          </Notice>
        ) : environmentQuery.data ? (
          <EnvironmentBlocks factoryId={factoryId} environment={environmentQuery.data} providers={providers} />
        ) : (
          <Skeleton className="h-24 w-full" />
        )}
      </SettingsSubsection>
    </div>
  );
}

function EnvironmentBlocks({
  factoryId,
  environment,
  providers,
}: {
  factoryId: string;
  environment: FactoryEnvironmentPayload;
  providers: RepositoryProviders;
}) {
  const saveMutation = useSaveFactoryEnvironmentMutation();

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

  // Resolves either way: callers fire and forget, the toast carries the failure.
  const save = (input: FactoryEnvironmentPatch) =>
    saveMutation
      .mutateAsync(
        { factoryId, input },
        {
          onSuccess: () => toast.success('Environment saved'),
          onError: err => toast.error(err instanceof Error ? err.message : 'Failed to save environment'),
        },
      )
      .then(
        () => true,
        () => false,
      );

  return (
    <div className="flex flex-col gap-8">
      <ResourcesBlock environment={environment} disabled={saveMutation.isPending} onSave={save} />
      <RepositoriesBlock
        repositories={environment.repositories}
        providers={providers}
        disabled={saveMutation.isPending}
        onSave={save}
      />
      <WorkspaceSetupBlock value={environment.workspaceSetupCommand} disabled={saveMutation.isPending} onSave={save} />
    </div>
  );
}
