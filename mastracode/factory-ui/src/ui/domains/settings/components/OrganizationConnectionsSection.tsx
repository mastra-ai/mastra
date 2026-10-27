import { Button } from '@mastra/playground-ui/components/Button';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { SettingsContainer, SettingsRow } from '@mastra/playground-ui/new/settings';
import { Check, Link2, Plus, RotateCcw } from 'lucide-react';
import { useId, useState } from 'react';
import type { ReactNode } from 'react';

import { useApiConfig } from '../../../../api/config';
import { useGithubStatusQuery } from '../../../../hooks/useGithubStatus';
import { useGitLabStatusQuery } from '../../../../hooks/useGitLabData';
import { useIncidentioStatusQuery } from '../../../../hooks/useIncidentioData';
import { useJiraStatusQuery } from '../../../../hooks/useJiraData';
import { useLinearStatusQuery } from '../../../../hooks/useLinearData';
import { usePlatformConnectionsQuery } from '../../../../hooks/usePlatformConnections';
import { SkeletonRows } from '../../../ui/SkeletonRows';
import { MASTRA_PROJECTS_URL } from '../../factory/services/gitlab';
import { connectLinear } from '../../factory/services/linear';
import { isPlatformConnectUnavailableError, PLATFORM_CONNECT_PROVIDERS } from '../../factory/services/platformConnect';
import type { PlatformConnectProviderId, PlatformProviderConnection } from '../../factory/services/platformConnect';
import { connectGithub, manageGithubConnection } from '../../workspaces/services/github';
import { ProviderConnectControl } from './PlatformProviderConnections';
import { SettingsSubsection } from './SettingsSubsection';
import { SettingsIntegrationIcon } from './brand-icons/SettingsIntegrationIcon';
import { ConnectionManagementButton } from './common/ConnectionManagementButton';

function ConnectionLabel({ icon, name }: { icon: ReactNode; name: string }) {
  return (
    <span className="flex items-center gap-2">
      {icon}
      {name}
    </span>
  );
}

export function OrganizationConnectionsSection() {
  const [adding, setAdding] = useState(false);
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
          <LinearConnectionRow showAvailable={adding} />
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
  const label = <ConnectionLabel icon={<SettingsIntegrationIcon provider="github" />} name="GitHub" />;

  if (query.isPending) return <SkeletonRows label="Loading GitHub connection" rows={1} rowClassName="h-16 w-full" />;
  if (query.isError || status?.reason === 'unavailable') {
    return (
      <SettingsRow label={label} errorMsg="Couldn't load GitHub connections.">
        <Button size="sm" icon={<RotateCcw />} onClick={() => void query.refetch()}>
          Retry
        </Button>
      </SettingsRow>
    );
  }
  if (!status) return null;
  if (status.authRequired || status.reason === 'auth_required') {
    return <SettingsRow label={label} description="Sign in to manage organization connections." />;
  }
  if (status.organizationRequired || status.reason === 'organization_required') {
    return <SettingsRow label={label} description="Select an organization to connect GitHub." />;
  }
  if (!status.enabled && !status.connected) {
    return showAvailable ? <SettingsRow label={label} description="Not configured on this server." /> : null;
  }
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

function LinearConnectionRow({ showAvailable }: { showAvailable: boolean }) {
  const { baseUrl } = useApiConfig();
  const query = useLinearStatusQuery();
  const status = query.data;
  const label = <ConnectionLabel icon={<SettingsIntegrationIcon provider="linear" />} name="Linear" />;

  if (query.isPending) return <SkeletonRows label="Loading Linear connection" rows={1} rowClassName="h-16 w-full" />;
  if (query.isError) {
    return (
      <SettingsRow label={label} errorMsg="Couldn't load Linear connections.">
        <Button size="sm" icon={<RotateCcw />} onClick={() => void query.refetch()}>
          Retry
        </Button>
      </SettingsRow>
    );
  }
  if (status?.reason === 'auth_required')
    return <SettingsRow label={label} description="Sign in to manage organization connections." />;
  if (status?.reason === 'organization_required')
    return <SettingsRow label={label} description="Select an organization to connect Linear." />;
  if (!status?.enabled) {
    return showAvailable ? <SettingsRow label={label} description="Not configured on this server." /> : null;
  }
  if (!status.connected && !showAvailable) return null;

  return (
    <SettingsRow label={label} description={status.workspace?.name || status.workspace?.urlKey || undefined}>
      <Button size="sm" icon={<Link2 />} onClick={() => connectLinear(baseUrl)}>
        {status.connected ? 'Reconnect Linear' : 'Connect Linear'}
      </Button>
    </SettingsRow>
  );
}

function GitLabConnectionRows({ showAvailable }: { showAvailable: boolean }) {
  const query = useGitLabStatusQuery();
  const status = query.data;
  if (query.isPending) return <SkeletonRows label="Loading GitLab connections" rows={1} rowClassName="h-16 w-full" />;
  if (query.isError || status?.reason === 'unavailable') {
    return (
      <SettingsRow label={<PlatformLabel provider="gitlab" />} errorMsg="Couldn't load GitLab connections.">
        <Button size="sm" icon={<RotateCcw />} onClick={() => void query.refetch()}>
          Retry
        </Button>
      </SettingsRow>
    );
  }
  if (status?.reason === 'auth_required') {
    return (
      <SettingsRow
        label={<PlatformLabel provider="gitlab" />}
        description="Sign in to manage organization connections."
      />
    );
  }
  if (status?.reason === 'organization_required') {
    return (
      <SettingsRow
        label={<PlatformLabel provider="gitlab" />}
        description="Select an organization to connect GitLab."
      />
    );
  }
  if (status?.mode === 'direct' && status.configured) {
    return (
      <SettingsRow
        label={<PlatformLabel provider="gitlab" />}
        description="Managed by deployment environment variables."
      />
    );
  }
  if (status?.mode !== 'platform') {
    return showAvailable ? (
      <SettingsRow label={<PlatformLabel provider="gitlab" />} description="Not configured on this server." />
    ) : null;
  }
  return <PlatformAccountRows provider="gitlab" connections={status.connections ?? []} showAvailable={showAvailable} />;
}

function JiraConnectionRows({ showAvailable }: { showAvailable: boolean }) {
  const query = useJiraStatusQuery();
  const status = query.data;
  if (query.isPending) return <SkeletonRows label="Loading Jira connections" rows={1} rowClassName="h-16 w-full" />;
  if (query.isError) {
    return (
      <SettingsRow label={<PlatformLabel provider="jira" />} errorMsg="Couldn't load Jira connections.">
        <Button size="sm" icon={<RotateCcw />} onClick={() => void query.refetch()}>
          Retry
        </Button>
      </SettingsRow>
    );
  }
  if (status?.reason === 'auth_required') {
    return (
      <SettingsRow
        label={<PlatformLabel provider="jira" />}
        description="Sign in to manage organization connections."
      />
    );
  }
  if (status?.reason === 'organization_required') {
    return (
      <SettingsRow label={<PlatformLabel provider="jira" />} description="Select an organization to connect Jira." />
    );
  }
  if (status?.mode === 'direct' && status.configured) {
    return (
      <SettingsRow
        label={<PlatformLabel provider="jira" />}
        description="Managed by deployment environment variables."
      />
    );
  }
  if (status?.mode !== 'platform' && status?.connections === undefined) {
    return showAvailable ? (
      <SettingsRow label={<PlatformLabel provider="jira" />} description="Not configured on this server." />
    ) : null;
  }
  return <PlatformAccountRows provider="jira" connections={status.connections ?? []} showAvailable={showAvailable} />;
}

function IncidentioConnectionRows({ showAvailable }: { showAvailable: boolean }) {
  const statusQuery = useIncidentioStatusQuery();
  const connectionsQuery = usePlatformConnectionsQuery('incident-io');
  const directConfigured = statusQuery.data?.mode === 'api-key' && statusQuery.data.configured;
  const label = <PlatformLabel provider="incident-io" />;

  if (statusQuery.isPending || connectionsQuery.isPending) {
    return <SkeletonRows label="Loading incident.io connections" rows={1} rowClassName="h-16 w-full" />;
  }
  if (directConfigured) return <SettingsRow label={label} description="API key configured on this server." />;
  if (connectionsQuery.isError) {
    if (isPlatformConnectUnavailableError(connectionsQuery.error)) {
      return showAvailable ? <SettingsRow label={label} description="Not configured on this server." /> : null;
    }
    return (
      <SettingsRow label={label} errorMsg={connectionsQuery.error.message}>
        <Button size="sm" icon={<RotateCcw />} onClick={() => void connectionsQuery.refetch()}>
          Retry
        </Button>
      </SettingsRow>
    );
  }
  return (
    <PlatformAccountRows provider="incident-io" connections={connectionsQuery.data} showAvailable={showAvailable} />
  );
}

function PlatformLabel({ provider }: { provider: PlatformConnectProviderId }) {
  if (provider === 'gitlab')
    return <ConnectionLabel icon={<SettingsIntegrationIcon provider="gitlab" />} name="GitLab" />;
  if (provider === 'jira') return <ConnectionLabel icon={<SettingsIntegrationIcon provider="jira" />} name="Jira" />;
  return <ConnectionLabel icon={<SettingsIntegrationIcon provider="incidentio" />} name="incident.io" />;
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
  const name = PLATFORM_CONNECT_PROVIDERS[provider].displayName;
  if (connections.length === 0) {
    if (!showAvailable) return null;
    return (
      <SettingsRow label={<PlatformLabel provider={provider} />}>
        <ProviderConnectControl provider={provider} label={`Connect ${name}`} icon={<Link2 />} />
      </SettingsRow>
    );
  }

  return connections.map((connection, index) => (
    <SettingsRow
      key={connection.id}
      label={<PlatformLabel provider={provider} />}
      description={connection.displayName?.trim() || connection.accountLabel?.trim() || 'Connected account'}
      errorMsg={connection.status === 'needs_reauth' ? 'Needs reauthorization' : undefined}
    >
      <div className="flex flex-wrap items-center gap-2">
        <ProviderConnectControl
          provider={provider}
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
                provider={provider}
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
