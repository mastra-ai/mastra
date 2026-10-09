import { Notice } from '@mastra/playground-ui/components/Notice';
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { toast } from '@mastra/playground-ui/components/Toaster';
import { Txt } from '@mastra/playground-ui/components/Txt';
import type { ReactNode } from 'react';
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
import { BuildTriggersBlock } from './environment/BuildTriggersBlock';
import { RepositoriesBlock, type RepositoryProviders } from './environment/RepositoriesBlock';
import { providerLine, SandboxBlock } from './environment/SandboxBlock';
import { WorkspaceSetupBlock } from './environment/WorkspaceSetupBlock';
import { SettingsSubsection } from './SettingsSubsection';

/**
 * The Factory's environment: what every session's sandbox boots from. The
 * Template section holds the ordered repositories and the workspace setup, the
 * Advanced section the sandbox provider's own settings.
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
    <div className="flex flex-col gap-10">
      <EnvironmentPart title="Template">
        <Txt as="p" variant="meta" tone="faint">
          {providerLine(environment.sandbox.provider)}
        </Txt>
        <RepositoriesBlock
          repositories={environment.repositories}
          providers={providers}
          disabled={disabled}
          onSave={save}
        />
        <WorkspaceSetupBlock
          workdir={environment.sandboxWorkdir}
          command={environment.workspaceSetupCommand}
          disabled={disabled}
          onSave={save}
        />
      </EnvironmentPart>
      {canBuild && (
        <EnvironmentPart title="Builds">
          <BuildBlocks factoryId={factoryId} environment={environment} />
        </EnvironmentPart>
      )}
      <EnvironmentPart title="Advanced">
        {canBuild && <BuildTriggersBlock triggers={environment.buildTriggers!} disabled={disabled} onSave={save} />}
        <SandboxBlock environment={environment} disabled={disabled} onSave={save} />
      </EnvironmentPart>
    </div>
  );
}

/** Build status, Build now and history; mounted only when the sandbox can build. */
function BuildBlocks({ factoryId, environment }: { factoryId: string; environment: FactoryEnvironmentPayload }) {
  const requestBuild = useRequestEnvironmentBuildMutation();
  const buildQuery = useEnvironmentBuildQuery(factoryId, environment.build?.buildId);
  const history = environment.sandbox.capabilities.builds.history;
  const buildsQuery = useEnvironmentBuildsQuery(factoryId, history);

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
    <>
      <BuildStatusBlock
        lastBuild={environment.build}
        build={buildQuery.data}
        activeTemplateId={environment.activeTemplateId}
        requesting={requestBuild.isPending}
        onBuildNow={buildNow}
      />
      {history && (
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
      )}
    </>
  );
}

/** One titled part of the page: Template, Builds, Advanced. */
export function EnvironmentPart({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-6">
      <Txt as="h2" variant="subheading">
        {title}
      </Txt>
      {children}
    </section>
  );
}
