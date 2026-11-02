import { Notice } from '@mastra/playground-ui/components/Notice';
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { toast } from '@mastra/playground-ui/components/Toaster';
import { SettingsContainer } from '@mastra/playground-ui/new/settings';

import {
  useEnvironmentBuildQuery,
  useEnvironmentBuildsQuery,
  useFactoryEnvironmentQuery,
  useRequestEnvironmentBuildMutation,
} from '../../../../hooks/useFactoryEnvironment';
import type { FactoryEnvironmentPayload } from '../../workspaces/services/environment';
import { BuildHistoryBlock } from './environment/BuildHistoryBlock';
import { BuildStatusBlock } from './environment/BuildStatusBlock';
import { BuildTriggersRows } from './environment/BuildTriggersBlock';
import { providerLine, SandboxBlock } from './environment/SandboxBlock';
import { WorkspaceSetupBlock } from './environment/WorkspaceSetupBlock';
import { useEnvironmentSave } from './environment/useEnvironmentSave';
import { SettingsSubsection } from './SettingsSubsection';

export function EnvironmentSection({ factoryId }: { factoryId: string }) {
  const environmentQuery = useFactoryEnvironmentQuery(factoryId);

  if (environmentQuery.isError) {
    return (
      <Notice variant="destructive">
        {environmentQuery.error instanceof Error ? environmentQuery.error.message : 'Failed to load environment'}
      </Notice>
    );
  }
  if (!environmentQuery.data) return <Skeleton className="h-24 w-full" />;

  return <EnvironmentBlocks key={factoryId} factoryId={factoryId} environment={environmentQuery.data} />;
}

function EnvironmentBlocks({ factoryId, environment }: { factoryId: string; environment: FactoryEnvironmentPayload }) {
  const { save, disabled } = useEnvironmentSave(factoryId);
  const canBuild = environment.sandbox.capabilities.builds.available && environment.buildTriggers !== undefined;
  return (
    <div className="flex min-w-0 flex-col gap-8">
      <SettingsSubsection
        scope="factory"
        title="Environment"
        description={`How each sandbox is set up. ${providerLine(environment.sandbox.provider)}`}
      >
        <WorkspaceSetupBlock
          workdir={environment.sandboxWorkingDirectory}
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
