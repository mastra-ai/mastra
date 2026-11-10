import { SettingsContainer, SettingsRow } from '@mastra/playground-ui/new/settings';

import { useGithubStatusQuery } from '../../../../hooks/useGithubStatus';
import { useGitLabStatusQuery } from '../../../../hooks/useGitLabData';
import { SettingsRowsSkeleton } from '../../../ui/SettingsRowsSkeleton';
import { GithubConnectButton, GithubManageButton } from './GithubConnectionControls';
import { IntegrationLabel } from './IntegrationLabel';
import {
  AddPlatformAccountRow,
  connectionName,
  PlatformConnectButton,
  PlatformLabel,
  PlatformManageLink,
  PlatformReconnectButton,
} from './PlatformProviderConnections';
import { SettingsSubsection } from './SettingsSubsection';
import { accessDescription, NotConfiguredRow, RetryRow } from './common/ConnectionStateRows';

export function SourceControlConnections() {
  return (
    <SettingsSubsection scope="org" title="Source control">
      <SettingsContainer>
        <GithubConnectionRow />
        <GitLabConnectionRows />
      </SettingsContainer>
    </SettingsSubsection>
  );
}

function GithubConnectionRow() {
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
  if (!status.enabled && !status.connected) return <NotConfiguredRow label={label} />;
  if (!status.connected) {
    return (
      <SettingsRow label={label}>
        <GithubConnectButton />
      </SettingsRow>
    );
  }
  return (
    <SettingsRow
      label={label}
      description={
        status.installations
          .map(installation => installation.accountLogin || `Installation ${installation.installationId}`)
          .join(', ') || undefined
      }
    >
      <GithubManageButton />
    </SettingsRow>
  );
}

function GitLabConnectionRows() {
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
  if (status?.mode !== 'platform') return <NotConfiguredRow label={label} />;
  const connections = status.connections ?? [];
  if (connections.length === 0) {
    return (
      <SettingsRow label={label}>
        <PlatformConnectButton provider="gitlab" />
      </SettingsRow>
    );
  }
  return (
    <>
      {connections.map((connection, index) => {
        const needsReauth = connection.status === 'needs_reauth';
        const last = index === connections.length - 1;
        return (
          <SettingsRow
            key={connection.id}
            label={label}
            description={connectionName(connection)}
            errorMsg={needsReauth ? 'Needs reauthorization' : undefined}
          >
            {needsReauth || last ? (
              <div className="flex flex-wrap items-center gap-2">
                {needsReauth && <PlatformReconnectButton provider="gitlab" connectionId={connection.id} />}
                {last && <PlatformManageLink provider="gitlab" />}
              </div>
            ) : undefined}
          </SettingsRow>
        );
      })}
      <AddPlatformAccountRow provider="gitlab" />
    </>
  );
}
