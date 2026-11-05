import { Button } from '@mastra/playground-ui/components/Button';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { SettingsContainer, SettingsRow } from '@mastra/playground-ui/new/settings';
import { Check, Link2, Plus } from 'lucide-react';
import { useId, useState } from 'react';
import { useSearchParams } from 'react-router';

import { useApiConfig } from '../../../../api/config';
import { useGithubStatusQuery } from '../../../../hooks/useGithubStatus';
import { useGitLabStatusQuery } from '../../../../hooks/useGitLabData';
import { useIncidentioStatusQuery } from '../../../../hooks/useIncidentioData';
import { useJiraStatusQuery } from '../../../../hooks/useJiraData';
import { usePlatformConnectionsQuery } from '../../../../hooks/usePlatformConnections';
import { SettingsRowsSkeleton } from '../../../ui/SettingsRowsSkeleton';
import { MASTRA_PROJECTS_URL } from '../../factory/services/gitlab';
import { isPlatformConnectUnavailableError, PLATFORM_CONNECT_PROVIDERS } from '../../factory/services/platformConnect';
import type { PlatformConnectProviderId, PlatformProviderConnection } from '../../factory/services/platformConnect';
import { connectGithub, manageGithubConnection } from '../../workspaces/services/github';
import { isIncidentioDirectConfigured } from './IncidentioIntakeSection';
import { IntegrationLabel } from './IntegrationLabel';
import { LinearConnectionRows } from './LinearConnectionRows';
import { connectionName, ProviderConnectControl } from './PlatformProviderConnections';
import { SettingsSubsection } from './SettingsSubsection';
import { ConnectionManagementButton } from './common/ConnectionManagementButton';
import { accessDescription, NotConfiguredRow, RetryRow } from './common/ConnectionStateRows';

const platformIcons = {
  gitlab: 'gitlab',
  jira: 'jira',
  'incident-io': 'incidentio',
} as const satisfies Record<PlatformConnectProviderId, string>;

export function OrganizationConnectionsSection() {
  const [searchParams] = useSearchParams();
  const [adding, setAdding] = useState(() => searchParams.has('add'));
  const connectionsId = useId();
  return (
    <SettingsSubsection
      scope="org"
      title="Organization connections"
      action={
        <Button
          size="sm"
          icon={adding ? <Check /> : <Plus />}
          aria-expanded={adding}
          aria-controls={connectionsId}
          onClick={() => setAdding(!adding)}
        >
          {adding ? 'Done' : 'Add connection'}
        </Button>
      }
    >
      <div id={connectionsId} className="flex flex-col gap-3">
        <SettingsContainer className="peer empty:hidden">
          <GithubInstallationRow showAvailable={adding} />
          <GitLabConnectionRows showAvailable={adding} />
          <LinearConnectionRows showAvailable={adding} />
          <JiraConnectionRows showAvailable={adding} />
          <IncidentioConnectionRows showAvailable={adding} />
        </SettingsContainer>
        <Txt as="p" variant="caption" tone="muted" className="hidden peer-empty:block">
          No organization connections.
        </Txt>
      </div>
    </SettingsSubsection>
  );
}

function GithubInstallationRow({ showAvailable }: { showAvailable: boolean }) {
  const { baseUrl } = useApiConfig();
  const query = useGithubStatusQuery();
  const status = query.data;
  const label = <IntegrationLabel provider="github" name="GitHub" />;

  if (query.isPending) return <SettingsRowsSkeleton label="Loading GitHub connection" rows={1} />;
  if (query.isError || status?.reason === 'unavailable') {
    return <RetryRow label={label} errorMsg="Couldn't load GitHub connections." onRetry={() => void query.refetch()} />;
  }
  if (!status) return null;
  const access = accessDescription(
    status.authRequired ? 'auth_required' : status.organizationRequired ? 'organization_required' : status.reason,
    'GitHub',
  );
  if (access) return <SettingsRow label={label} description={access} />;
  if (!status.enabled && !status.connected) return <NotConfiguredRow label={label} showAvailable={showAvailable} />;
  if (!status.connected && !showAvailable) return null;

  return (
    <SettingsRow
      label={label}
      description={
        status.installations
          .map(installation => installation.accountLogin || `Installation ${installation.installationId}`)
          .join(', ') || undefined
      }
    >
      {status.connected ? (
        <ConnectionManagementButton onClick={() => manageGithubConnection(baseUrl)}>
          Manage GitHub connection
        </ConnectionManagementButton>
      ) : (
        <Button size="sm" icon={<Link2 />} onClick={() => connectGithub(baseUrl)}>
          Connect GitHub
        </Button>
      )}
    </SettingsRow>
  );
}

function GitLabConnectionRows({ showAvailable }: { showAvailable: boolean }) {
  const query = useGitLabStatusQuery();
  const status = query.data;
  const label = <PlatformLabel provider="gitlab" />;

  if (query.isPending) return <SettingsRowsSkeleton label="Loading GitLab connections" rows={1} />;
  if (query.isError || status?.reason === 'unavailable') {
    return <RetryRow label={label} errorMsg="Couldn't load GitLab connections." onRetry={() => void query.refetch()} />;
  }
  const access = accessDescription(status?.reason, 'GitLab');
  if (access) return <SettingsRow label={label} description={access} />;
  if (status?.mode === 'direct' && status.enabled && status.configured) {
    return <SettingsRow label={label} description="Managed by deployment environment variables." />;
  }
  if (status?.mode !== 'platform') return <NotConfiguredRow label={label} showAvailable={showAvailable} />;
  return <PlatformAccountRows provider="gitlab" connections={status.connections ?? []} showAvailable={showAvailable} />;
}

function JiraConnectionRows({ showAvailable }: { showAvailable: boolean }) {
  const query = useJiraStatusQuery();
  const status = query.data;
  const label = <PlatformLabel provider="jira" />;

  if (query.isPending) return <SettingsRowsSkeleton label="Loading Jira connections" rows={1} />;
  if (status?.reason === 'unavailable') {
    return <RetryRow label={label} errorMsg="Couldn't load Jira connections." onRetry={() => void query.refetch()} />;
  }
  const access = accessDescription(status?.reason, 'Jira');
  if (access) return <SettingsRow label={label} description={access} />;
  if (status?.mode === 'direct' && status.enabled && status.configured) {
    return <SettingsRow label={label} description="Managed by deployment environment variables." />;
  }
  if (status?.mode !== 'platform' && status?.connections === undefined) {
    return <NotConfiguredRow label={label} showAvailable={showAvailable} />;
  }
  return <PlatformAccountRows provider="jira" connections={status.connections ?? []} showAvailable={showAvailable} />;
}

function IncidentioConnectionRows({ showAvailable }: { showAvailable: boolean }) {
  const statusQuery = useIncidentioStatusQuery();
  const connectionsQuery = usePlatformConnectionsQuery('incident-io');
  const label = <PlatformLabel provider="incident-io" />;

  if (statusQuery.isPending || connectionsQuery.isPending) {
    return <SettingsRowsSkeleton label="Loading incident.io connections" rows={1} />;
  }
  if (statusQuery.isError) {
    return (
      <RetryRow label={label} errorMsg="Couldn't load incident.io status." onRetry={() => void statusQuery.refetch()} />
    );
  }
  if (isIncidentioDirectConfigured(statusQuery.data)) {
    return <SettingsRow label={label} description="API key configured on this server." />;
  }
  if (connectionsQuery.isError) {
    if (isPlatformConnectUnavailableError(connectionsQuery.error)) {
      return <NotConfiguredRow label={label} showAvailable={showAvailable} />;
    }
    return (
      <RetryRow
        label={label}
        errorMsg={connectionsQuery.error.message}
        onRetry={() => void connectionsQuery.refetch()}
      />
    );
  }
  return (
    <PlatformAccountRows provider="incident-io" connections={connectionsQuery.data} showAvailable={showAvailable} />
  );
}

function PlatformLabel({ provider }: { provider: PlatformConnectProviderId }) {
  return (
    <IntegrationLabel provider={platformIcons[provider]} name={PLATFORM_CONNECT_PROVIDERS[provider].displayName} />
  );
}

function PlatformAccountRows({
  provider,
  connections,
  showAvailable,
}: {
  provider: PlatformConnectProviderId;
  connections: PlatformProviderConnection[];
  showAvailable: boolean;
}) {
  const meta = PLATFORM_CONNECT_PROVIDERS[provider];
  const name = meta.displayName;
  if (connections.length === 0) {
    if (!showAvailable) return null;
    return (
      <SettingsRow label={<PlatformLabel provider={provider} />}>
        <ProviderConnectControl provider={meta} label={`Connect ${name}`} icon={<Link2 />} />
      </SettingsRow>
    );
  }

  return connections.map((connection, index) => (
    <SettingsRow
      key={connection.id}
      label={<PlatformLabel provider={provider} />}
      description={connectionName(connection)}
      errorMsg={connection.status === 'needs_reauth' ? 'Needs reauthorization' : undefined}
    >
      <div className="flex flex-wrap items-center gap-2">
        <ProviderConnectControl
          provider={meta}
          reconnectConnectionId={connection.id}
          label={`Reconnect ${name}`}
          icon={<Link2 />}
          buttonLabel="Reconnect"
          variant={connection.status === 'needs_reauth' ? 'default' : 'ghost'}
        />
        {index === connections.length - 1 && (
          <>
            {provider === 'gitlab' && (
              <ConnectionManagementButton
                render={<a href={MASTRA_PROJECTS_URL} target="_blank" rel="noopener noreferrer" />}
              >
                Manage GitLab connection
              </ConnectionManagementButton>
            )}
            {showAvailable && (
              <ProviderConnectControl
                provider={meta}
                label={`Connect another ${name} account`}
                buttonLabel="Add account"
                icon={<Plus />}
                variant="ghost"
              />
            )}
          </>
        )}
      </div>
    </SettingsRow>
  ));
}
