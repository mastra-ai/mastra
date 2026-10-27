import { Button } from '@mastra/playground-ui/components/Button';
import { toast } from '@mastra/playground-ui/components/Toaster';
import { SettingsContainer, SettingsRow } from '@mastra/playground-ui/new/settings';
import { RotateCcw } from 'lucide-react';
import { useFactoriesQuery } from '../../../../hooks/useFactories';
import { useGithubStatusQuery } from '../../../../hooks/useGithubStatus';
import { useGitLabStatusQuery } from '../../../../hooks/useGitLabData';
import { useIncidentioStatusQuery } from '../../../../hooks/useIncidentioData';
import { useIntakeConfigQuery, useSaveIntakeConfigMutation } from '../../../../hooks/useIntakeConfig';
import { useJiraStatusQuery } from '../../../../hooks/useJiraData';
import { useLinearStatusQuery } from '../../../../hooks/useLinearData';
import { usePlatformConnectionsQuery } from '../../../../hooks/usePlatformConnections';
import { SkeletonRows } from '../../../ui/SkeletonRows';
import type { IntakeConfig } from '../../factory/services/intake';
import { isPlatformConnectUnavailableError } from '../../factory/services/platformConnect';
import { GithubIntakeSection } from './GithubIntakeSection';
import { GitLabIntakeSection } from './GitLabIntakeSection';
import { IncidentioIntakeSection, isIncidentioDirectConfigured } from './IncidentioIntakeSection';
import { JiraIntakeSection } from './JiraIntakeSection';
import { LinearIntakeSection } from './LinearIntakeSection';
import { SettingsSubsection } from './SettingsSubsection';

export function IntakeSection() {
  const configQuery = useIntakeConfigQuery();
  const saveMutation = useSaveIntakeConfigMutation();
  const factoriesQuery = useFactoriesQuery();
  const github = useGithubStatusQuery();
  const gitlab = useGitLabStatusQuery();
  const linear = useLinearStatusQuery();
  const jira = useJiraStatusQuery();
  const incidentio = useIncidentioStatusQuery();
  const incidentioConnections = usePlatformConnectionsQuery('incident-io');

  if (configQuery.isPending) return <SkeletonRows label="Loading intake sources" rows={4} />;
  if (configQuery.isError || !configQuery.data) {
    return (
      <SettingsRow label="Intake configuration is unavailable" description="Your sources could not be loaded.">
        <Button size="sm" variant="ghost" icon={<RotateCcw />} onClick={() => void configQuery.refetch()}>
          Retry
        </Button>
      </SettingsRow>
    );
  }

  if (
    github.isPending ||
    gitlab.isPending ||
    linear.isPending ||
    jira.isPending ||
    incidentio.isPending ||
    incidentioConnections.isPending
  ) {
    return <SkeletonRows label="Loading intake sources" rows={4} />;
  }

  const update = async (next: IntakeConfig) => {
    try {
      await saveMutation.mutateAsync(next);
      toast.success('Intake sources updated');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save intake sources');
    }
  };
  const props = {
    config: configQuery.data,
    busy: saveMutation.isPending,
    update,
    factories: factoriesQuery.data ?? [],
  };
  const platformUnavailable =
    incidentioConnections.isError && isPlatformConnectUnavailableError(incidentioConnections.error);
  const incidentioDirect = isIncidentioDirectConfigured(incidentio.data);
  const showIncidentio = !platformUnavailable || incidentioDirect;
  const providers = [
    {
      id: 'github',
      connected: Boolean(github.data?.connected || github.data?.installations.length),
      unavailable: github.isError || github.data?.reason === 'unavailable',
      content: (
        <GithubIntakeSection
          {...props}
          statusQuery={github}
          loading={factoriesQuery.isPending}
          error={factoriesQuery.isError}
          onRetry={() => void factoriesQuery.refetch()}
        />
      ),
    },
    {
      id: 'gitlab',
      connected: Boolean(gitlab.data?.configured || gitlab.data?.connections?.length),
      unavailable: gitlab.isError || gitlab.data?.reason === 'unavailable',
      content: <GitLabIntakeSection {...props} statusQuery={gitlab} />,
    },
    {
      id: 'linear',
      connected: Boolean(linear.data?.connected),
      unavailable: linear.isError,
      content: <LinearIntakeSection {...props} statusQuery={linear} />,
    },
    {
      id: 'jira',
      connected: Boolean(jira.data?.configured || jira.data?.connections?.length),
      unavailable: jira.isError,
      content: <JiraIntakeSection {...props} statusQuery={jira} />,
    },
    {
      id: 'incidentio',
      connected: incidentioDirect || Boolean(incidentioConnections.data?.length),
      unavailable: incidentio.isError || (!platformUnavailable && incidentioConnections.isError),
      content: showIncidentio ? (
        <IncidentioIntakeSection {...props} statusQuery={incidentio} connectionsQuery={incidentioConnections} />
      ) : undefined,
    },
  ];
  const connectedProviders = providers.filter(provider => provider.connected && provider.content);
  const unavailableProviders = providers.filter(
    provider => !provider.connected && provider.unavailable && provider.content,
  );
  const availableProviders = providers.filter(
    provider => !provider.connected && !provider.unavailable && provider.content,
  );

  return (
    <div className="flex flex-col gap-8">
      <SettingsSubsection
        scope="org"
        title="Connected sources"
        description="Choose which services bring work into your organization's boards."
      >
        <div className="flex flex-col gap-6">
          {connectedProviders.map(provider => (
            <div key={provider.id}>{provider.content}</div>
          ))}
        </div>
      </SettingsSubsection>
      {unavailableProviders.length > 0 && (
        <SettingsSubsection title="Unavailable sources">
          <div className="flex flex-col gap-6">
            {unavailableProviders.map(provider => (
              <div key={provider.id}>{provider.content}</div>
            ))}
          </div>
        </SettingsSubsection>
      )}
      {availableProviders.length > 0 && (
        <SettingsSubsection title="Add a source">
          <SettingsContainer>
            {availableProviders.map(provider => (
              <div key={provider.id}>{provider.content}</div>
            ))}
          </SettingsContainer>
        </SettingsSubsection>
      )}
    </div>
  );
}
