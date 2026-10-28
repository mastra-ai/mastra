import { Button } from '@mastra/playground-ui/components/Button';
import { toast } from '@mastra/playground-ui/components/Toaster';
import { SettingsContainer, SettingsRow } from '@mastra/playground-ui/new/settings';
import { RotateCcw } from 'lucide-react';
import { useGithubStatusQuery } from '../../../../hooks/useGithubStatus';
import { useGitLabStatusQuery } from '../../../../hooks/useGitLabData';
import { useIncidentioStatusQuery } from '../../../../hooks/useIncidentioData';
import {
  useIntakeBindingsQuery,
  useIntakeConfigQuery,
  useSaveIntakeConfigMutation,
} from '../../../../hooks/useIntakeConfig';
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

type SourceListing = 'connected' | 'unavailable' | 'available';

function sourceListing(connected: boolean, unavailable: boolean): SourceListing {
  if (connected) return 'connected';
  if (unavailable) return 'unavailable';
  return 'available';
}

export function IntakeSection() {
  const configQuery = useIntakeConfigQuery();
  const saveMutation = useSaveIntakeConfigMutation();
  useIntakeBindingsQuery();
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
  const props = { config: configQuery.data, busy: saveMutation.isPending, update };
  const incidentioDirect = isIncidentioDirectConfigured(incidentio.data);
  const incidentioPlatformUnavailable =
    incidentioConnections.isError && isPlatformConnectUnavailableError(incidentioConnections.error);
  const githubListing = sourceListing(
    Boolean(github.data?.connected || github.data?.installations.length),
    github.isError || github.data?.reason === 'unavailable',
  );
  const gitlabListing = sourceListing(
    Boolean(gitlab.data?.configured || gitlab.data?.connections?.length),
    gitlab.isError || gitlab.data?.reason === 'unavailable',
  );
  const linearListing = sourceListing(Boolean(linear.data?.connected), linear.isError);
  const jiraListing = sourceListing(Boolean(jira.data?.configured || jira.data?.connections?.length), jira.isError);
  // 403/404: Platform connections aren't offered here.
  const incidentioListing =
    incidentioPlatformUnavailable && !incidentioDirect
      ? undefined
      : sourceListing(
          incidentioDirect || Boolean(incidentioConnections.data?.length),
          incidentio.isError || incidentioConnections.isError,
        );
  // Pass gated queries down: a new observer on an errored query refetches on mount and loops the gate.
  const sources = [
    {
      id: 'github',
      listing: githubListing,
      content: <GithubIntakeSection {...props} listed={githubListing !== 'available'} statusQuery={github} />,
    },
    {
      id: 'gitlab',
      listing: gitlabListing,
      content: <GitLabIntakeSection {...props} listed={gitlabListing !== 'available'} statusQuery={gitlab} />,
    },
    {
      id: 'linear',
      listing: linearListing,
      content: <LinearIntakeSection {...props} listed={linearListing !== 'available'} statusQuery={linear} />,
    },
    {
      id: 'jira',
      listing: jiraListing,
      content: <JiraIntakeSection {...props} listed={jiraListing !== 'available'} statusQuery={jira} />,
    },
    {
      id: 'incidentio',
      listing: incidentioListing,
      content: (
        <IncidentioIntakeSection
          {...props}
          listed={incidentioListing !== 'available'}
          statusQuery={incidentio}
          connectionsQuery={incidentioConnections}
        />
      ),
    },
  ];
  const sourcesListed = (listing: SourceListing) => sources.filter(source => source.listing === listing);
  const connectedSources = sourcesListed('connected');
  const unavailableSources = sourcesListed('unavailable');
  const availableSources = sourcesListed('available');

  return (
    <div className="flex flex-col gap-8">
      {connectedSources.length > 0 && (
        <SettingsSubsection
          scope="org"
          title="Connected sources"
          description="Choose which services bring work into your organization's boards."
        >
          <div className="flex flex-col gap-6">
            {connectedSources.map(source => (
              <div key={source.id}>{source.content}</div>
            ))}
          </div>
        </SettingsSubsection>
      )}
      {unavailableSources.length > 0 && (
        <SettingsSubsection title="Unavailable sources">
          <div className="flex flex-col gap-6">
            {unavailableSources.map(source => (
              <div key={source.id}>{source.content}</div>
            ))}
          </div>
        </SettingsSubsection>
      )}
      {availableSources.length > 0 && (
        <SettingsSubsection title="Add a source">
          <SettingsContainer>
            {availableSources.map(source => (
              <div key={source.id}>{source.content}</div>
            ))}
          </SettingsContainer>
        </SettingsSubsection>
      )}
    </div>
  );
}
