import { Button } from '@mastra/playground-ui/components/Button';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { SettingsContainer, SettingsRow } from '@mastra/playground-ui/new/settings';
import { Check, Link2, Plus, RotateCcw, Share2 } from 'lucide-react';
import { useId, useState } from 'react';
import type { ReactNode } from 'react';
import { useSearchParams } from 'react-router';

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
import {
  connectGithub,
  INSTALL_ON_GITHUB_ORGANIZATION,
  manageGithubConnection,
  SHARE_WITH_THIS_FACTORY,
  shareGithubInstallation,
  unavailableInstallNotice,
} from '../../workspaces/services/github';
import { isIncidentioDirectConfigured } from './IncidentioIntakeSection';
import { IntegrationLabel } from './IntegrationLabel';
import { connectionName, ProviderConnectControl } from './PlatformProviderConnections';
import { SettingsSubsection } from './SettingsSubsection';
import { ConnectionManagementButton } from './common/ConnectionManagementButton';

const platformIcons = {
  gitlab: 'gitlab',
  jira: 'jira',
  'incident-io': 'incidentio',
} as const satisfies Record<PlatformConnectProviderId, string>;

function accessDescription(reason: string | undefined, name: string): string | undefined {
  if (reason === 'auth_required') return 'Sign in to manage organization connections.';
  if (reason === 'organization_required') return `Select an organization to connect ${name}.`;
  return undefined;
}

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

function RetryRow({ label, errorMsg, onRetry }: { label: ReactNode; errorMsg: string; onRetry: () => void }) {
  return (
    <SettingsRow label={label} errorMsg={errorMsg}>
      <Button size="sm" icon={<RotateCcw />} onClick={onRetry}>
        Retry
      </Button>
    </SettingsRow>
  );
}

function NotConfiguredRow({ label, showAvailable }: { label: ReactNode; showAvailable: boolean }) {
  if (!showAvailable) return null;
  return <SettingsRow label={label} description="Not configured on this server." />;
}

function GithubInstallationRow({ showAvailable }: { showAvailable: boolean }) {
  const { baseUrl } = useApiConfig();
  const query = useGithubStatusQuery();
  const status = query.data;
  const label = <IntegrationLabel provider="github" name="GitHub" />;

  if (query.isPending) return <SkeletonRows label="Loading GitHub connection" rows={1} rowClassName="h-16 w-full" />;
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
  const notice = unavailableInstallNotice(status);
  if (!status.connected && !showAvailable && !notice) return null;
  const shareUrl = notice?.shareUrl;
  const accounts = status.installations
    .map(installation => installation.accountLogin || `Installation ${installation.installationId}`)
    .join(', ');

  return (
    <SettingsRow label={label} description={[accounts, notice?.message].filter(Boolean).join(' · ') || undefined}>
      {status.connected ? (
        <ConnectionManagementButton onClick={() => manageGithubConnection(baseUrl)}>
          Manage GitHub connection
        </ConnectionManagementButton>
      ) : notice?.temporary ? (
        <Button size="sm" icon={<RotateCcw />} disabled={query.isFetching} onClick={() => void query.refetch()}>
          Retry
        </Button>
      ) : (
        <Button
          size="sm"
          variant={shareUrl ? 'ghost' : undefined}
          icon={<Link2 />}
          onClick={() => connectGithub(baseUrl)}
        >
          {notice ? INSTALL_ON_GITHUB_ORGANIZATION : 'Connect GitHub'}
        </Button>
      )}
      {shareUrl && (
        <Button size="sm" icon={<Share2 />} onClick={() => shareGithubInstallation(shareUrl)}>
          {SHARE_WITH_THIS_FACTORY}
        </Button>
      )}
    </SettingsRow>
  );
}

function LinearConnectionRow({ showAvailable }: { showAvailable: boolean }) {
  const { baseUrl } = useApiConfig();
  const query = useLinearStatusQuery();
  const status = query.data;
  const label = <IntegrationLabel provider="linear" name="Linear" />;

  if (query.isPending) return <SkeletonRows label="Loading Linear connection" rows={1} rowClassName="h-16 w-full" />;
  if (status?.reason === 'unavailable') {
    return <RetryRow label={label} errorMsg="Couldn't load Linear connections." onRetry={() => void query.refetch()} />;
  }
  const access = accessDescription(status?.reason, 'Linear');
  if (access) return <SettingsRow label={label} description={access} />;
  if (!status?.enabled) return <NotConfiguredRow label={label} showAvailable={showAvailable} />;
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
  const label = <PlatformLabel provider="gitlab" />;

  if (query.isPending) return <SkeletonRows label="Loading GitLab connections" rows={1} rowClassName="h-16 w-full" />;
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

  if (query.isPending) return <SkeletonRows label="Loading Jira connections" rows={1} rowClassName="h-16 w-full" />;
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
    return <SkeletonRows label="Loading incident.io connections" rows={1} rowClassName="h-16 w-full" />;
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
      description={connectionName(connection)}
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
