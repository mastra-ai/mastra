import { Notice } from '@mastra/playground-ui/components/Notice';
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { toast } from '@mastra/playground-ui/components/Toaster';
import { Txt } from '@mastra/playground-ui/components/Txt';
import type { ReactNode } from 'react';
import { Link, useParams } from 'react-router';

import { useFactoryQuery } from '../../../../hooks/useFactories';
import { useFactoryEnvironmentQuery, useSaveFactoryEnvironmentMutation } from '../../../../hooks/useFactoryEnvironment';
import type { FactoryEnvironmentPatch, FactoryEnvironmentPayload } from '../../workspaces/services/environment';
import { settingsSectionPath } from '../settingsSections';
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
          onSuccess: () => toast.success('Environment saved'),
          onError: err => toast.error(err instanceof Error ? err.message : 'Failed to save environment'),
        },
      )
      .then(
        () => true,
        () => false,
      );

  const disabled = saveMutation.isPending;
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
      <EnvironmentPart title="Advanced">
        <SandboxBlock environment={environment} disabled={disabled} onSave={save} />
      </EnvironmentPart>
    </div>
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
