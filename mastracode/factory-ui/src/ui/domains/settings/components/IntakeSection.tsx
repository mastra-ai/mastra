import { Button } from '@mastra/playground-ui/components/Button';
import { SettingsContainer, SettingsRow, SettingsSkeleton } from '@mastra/playground-ui/new/settings';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { IconArrowRotateCounterClockwise } from '@mastra/playground-ui/icons/central/IconArrowRotateCounterClockwise';
import { Fragment } from 'react';
import { Link, useParams } from 'react-router';
import { useGithubStatusQuery } from '../../../../hooks/useGithubStatus';
import { useGitLabStatusQuery } from '../../../../hooks/useGitLabData';
import { useIncidentioStatusQuery } from '../../../../hooks/useIncidentioData';
import { useIntakeBindingsQuery, useIntakeConfigQuery } from '../../../../hooks/useIntakeConfig';
import { useJiraStatusQuery } from '../../../../hooks/useJiraData';
import { useLinearStatusQuery } from '../../../../hooks/useLinearData';
import { usePlatformConnectionsQuery } from '../../../../hooks/usePlatformConnections';
import { boardIntakePath } from '../../boardConfig/boardConfigPaths';
import { isPlatformConnectUnavailableError } from '../../factory/services/platformConnect';
import { GithubIntakeSection } from './GithubIntakeSection';
import { GitLabIntakeSection } from './GitLabIntakeSection';
import { IncidentioIntakeSection, isIncidentioDirectConfigured } from './IncidentioIntakeSection';
import { JiraIntakeSection } from './JiraIntakeSection';
import { LinearIntakeSection } from './LinearIntakeSection';
import { SettingsSubsection } from './SettingsSubsection';
import { useVantaStatusQuery, VantaIntakeSection } from './VantaIntakeSection';

type SourceListing = 'connected' | 'unavailable' | 'available';

function sourceListing(connected: boolean, unavailable: boolean): SourceListing {
  if (connected) return 'connected';
  if (unavailable) return 'unavailable';
  return 'available';
}

function IntakeSkeleton() {
  return (
    <SettingsContainer>
      <SettingsSkeleton label="Loading intake sources" variant="item" rows={4} />
    </SettingsContainer>
  );
}

export function IntakeSection() {
  const { factoryId } = useParams<{ factoryId: string }>();
  const configQuery = useIntakeConfigQuery();
  useIntakeBindingsQuery();
  const github = useGithubStatusQuery();
  const gitlab = useGitLabStatusQuery();
  const linear = useLinearStatusQuery();
  const jira = useJiraStatusQuery();
  const incidentio = useIncidentioStatusQuery();
  const incidentioConnections = usePlatformConnectionsQuery('incident-io');
  const vanta = useVantaStatusQuery();
  const vantaConnections = usePlatformConnectionsQuery('vanta', Boolean(vanta.data));

  if (configQuery.isPending) return <IntakeSkeleton />;
  if (!configQuery.data) {
    return (
      <SettingsContainer>
        <SettingsRow label="Intake configuration is unavailable" description="Your sources could not be loaded.">
          <Button
            size="sm"
            variant="ghost"
            icon={<IconArrowRotateCounterClockwise />}
            onClick={() => void configQuery.refetch()}
          >
            Retry
          </Button>
        </SettingsRow>
      </SettingsContainer>
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
    return <IntakeSkeleton />;
  }

  const props = { config: configQuery.data };
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
  const linearListing = sourceListing(
    Boolean(
      linear.data?.enabled &&
      (linear.data.connected ||
        linear.data.workspaces?.length ||
        props.config.linear.sourceIds?.length ||
        linear.data.migration?.required ||
        linear.data.requiresFreshConnect?.length),
    ),
    linear.isError || linear.data?.reason === 'unavailable',
  );
  const jiraListing = sourceListing(Boolean(jira.data?.configured || jira.data?.connections?.length), jira.isError);
  // 403/404: Platform connections aren't offered here.
  const incidentioListing =
    incidentioPlatformUnavailable && !incidentioDirect
      ? undefined
      : sourceListing(
          incidentioDirect || Boolean(incidentioConnections.data?.length),
          incidentio.isError || incidentioConnections.isError,
        );
  const vantaListing = sourceListing(
    Boolean(vantaConnections.data?.length),
    vantaConnections.isError && isPlatformConnectUnavailableError(vantaConnections.error),
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
    ...(vanta.data
      ? [
          {
            id: 'vanta',
            listing: vantaListing,
            content: (
              <VantaIntakeSection
                {...props}
                listed={vantaListing !== 'available'}
                statusQuery={vanta}
                connectionsQuery={vantaConnections}
              />
            ),
          },
        ]
      : []),
  ];

  return (
    <SettingsSubsection
      scope="org"
      title="Sources"
      description="The services that bring work into your organization's boards, and what each one brings in. A service with nothing selected brings in nothing."
    >
      <div className="flex flex-col gap-3">
        {sources.flatMap(source =>
          source.listing === undefined
            ? []
            : [
                source.listing === 'available' ? (
                  <SettingsContainer key={source.id}>{source.content}</SettingsContainer>
                ) : (
                  <Fragment key={source.id}>{source.content}</Fragment>
                ),
              ],
        )}
      </div>
      {factoryId && (
        <Txt as="p" variant="caption" tone="muted">
          Which board takes each item is set in each board's Rules, in the{' '}
          <Link to={boardIntakePath(factoryId, 'work')} className="underline">
            intake order
          </Link>
          .
        </Txt>
      )}
    </SettingsSubsection>
  );
}
