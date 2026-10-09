import { Notice } from '@mastra/playground-ui/components/Notice';
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { toast } from '@mastra/playground-ui/components/Toaster';
import { SettingsContainer } from '@mastra/playground-ui/new/settings';
import { Link, useParams } from 'react-router';

import { useFactoryQuery } from '../../../../hooks/useFactories';
import {
  useEnvironmentBuildQuery,
  useEnvironmentBuildsQuery,
  useFactoryEnvironmentQuery,
  useRequestEnvironmentBuildMutation,
  useSaveFactoryEnvironmentMutation,
} from '../../../../hooks/useFactoryEnvironment';
import type { FactoryEnvironmentPatch, FactoryEnvironmentPayload } from '../../workspaces/services/environment';
import { settingsSectionPath } from '../settingsSections';
import { BuildHistoryBlock } from './environment/BuildHistoryBlock';
import { BuildStatusBlock } from './environment/BuildStatusBlock';
import { BuildTriggersRows } from './environment/BuildTriggersBlock';
import { RepositoriesBlock, type RepositoryProviders } from './environment/RepositoriesBlock';
import { providerLine, SandboxBlock } from './environment/SandboxBlock';
import { WorkspaceSetupBlock } from './environment/WorkspaceSetupBlock';
import { SettingsSubsection } from './SettingsSubsection';

/**
 * The Factory's environment: what every session's sandbox boots from. The
 * repositories it clones, its configuration (workspace setup and the sandbox
 * provider's own settings) and, when the sandbox can build, its builds.
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

  if (environmentQuery.isError) {
    return (
      <Notice variant="destructive">
        {environmentQuery.error instanceof Error ? environmentQuery.error.message : 'Failed to load environment'}
      </Notice>
    );
  }
  if (!environmentQuery.data) return <Skeleton className="h-24 w-full" />;

  return <EnvironmentBlocks factoryId={factoryId} environment={environmentQuery.data} providers={providers} />;
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
          onSuccess: saved => toast.success(saved.environment.buildRequested ? 'Build queued' : 'Environment saved'),
          onError: err => toast.error(err instanceof Error ? err.message : 'Failed to save environment'),
        },
      )
      .then(
        () => true,
        () => false,
      );

  const disabled = saveMutation.isPending;
  const canBuild = environment.sandbox.capabilities.builds.available && environment.buildTriggers !== undefined;
  return (
    <div className="flex min-w-0 flex-col gap-8">
      <SettingsSubsection
        scope="factory"
        title="Repositories"
        description="Repositories cloned into each new sandbox, in this order."
      >
        <RepositoriesBlock
          repositories={environment.repositories}
          providers={providers}
          disabled={disabled}
          onSave={save}
        />
      </SettingsSubsection>
      <SettingsSubsection
        scope="factory"
        title="Configuration"
        description={`How each sandbox is set up. ${providerLine(environment.sandbox.provider)}`}
      >
        <WorkspaceSetupBlock
          workdir={environment.sandboxWorkdir}
          command={environment.workspaceSetupCommand}
          disabled={disabled}
          onSave={save}
        >
          <SandboxBlock environment={environment} disabled={disabled} onSave={save} />
        </WorkspaceSetupBlock>
      </SettingsSubsection>
      {canBuild && (
        <SettingsSubsection
          scope="factory"
          title="Builds"
          description="The template image built ahead of sessions, and when it rebuilds."
          action={<BuildNow factoryId={factoryId} environment={environment} />}
        >
          <div className="flex flex-col gap-4">
            <SettingsContainer>
              <BuildTriggersRows triggers={environment.buildTriggers!} disabled={disabled} onSave={save} />
            </SettingsContainer>
            {environment.sandbox.capabilities.builds.history && <BuildHistory factoryId={factoryId} />}
          </div>
        </SettingsSubsection>
      )}
    </div>
  );
}

/** Build now with the last build's live status beside it; in the Builds header. */
function BuildNow({ factoryId, environment }: { factoryId: string; environment: FactoryEnvironmentPayload }) {
  const requestBuild = useRequestEnvironmentBuildMutation();
  const buildQuery = useEnvironmentBuildQuery(factoryId, environment.build?.buildId);

  const buildNow = () =>
    requestBuild.mutate(
      { factoryId },
      {
        onSuccess: started => {
          if (started.outcome === 'started') toast.success('Build started');
          else toast.error(`Build not started: ${started.reason ?? started.outcome}`);
        },
        onError: err => toast.error(err instanceof Error ? err.message : 'Failed to start the build'),
      },
    );

  return (
    <BuildStatusBlock
      lastBuild={environment.build}
      build={buildQuery.data}
      requesting={requestBuild.isPending}
      onBuildNow={buildNow}
    />
  );
}

/** The provider's build history; mounted only when the sandbox lists builds. */
function BuildHistory({ factoryId }: { factoryId: string }) {
  const buildsQuery = useEnvironmentBuildsQuery(factoryId, true);
  return (
    <BuildHistoryBlock
      builds={buildsQuery.data}
      error={
        buildsQuery.isError
          ? buildsQuery.error instanceof Error
            ? buildsQuery.error.message
            : 'Failed to load builds'
          : undefined
      }
    />
  );
}
