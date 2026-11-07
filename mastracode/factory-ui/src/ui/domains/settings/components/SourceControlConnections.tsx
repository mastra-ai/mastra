import { SettingsContainer } from '@mastra/playground-ui/new/settings';

import { useGithubStatusQuery } from '../../../../hooks/useGithubStatus';
import { useGitLabStatusQuery } from '../../../../hooks/useGitLabData';
import { SettingsRowsSkeleton } from '../../../ui/SettingsRowsSkeleton';
import { GithubConnectButton, GithubManageButton } from './GithubConnectionControls';
import { IntegrationItem } from './IntegrationItem';
import {
  AddPlatformAccountRow,
  connectionName,
  PlatformConnectButton,
  PlatformManageLink,
  PlatformReconnectButton,
  platformIntegration,
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
  const github = { provider: 'github', name: 'GitHub' } as const;

  if (query.isPending) return <SettingsRowsSkeleton label="Loading GitHub connection" rows={1} />;
  if (query.isError || status?.reason === 'unavailable') {
    return (
      <RetryRow
        label={github.name}
        provider={github.provider}
        errorMsg="Couldn't load GitHub connections."
        onRetry={() => void query.refetch()}
      />
    );
  }
  if (!status) return null;
  const access = accessDescription(
    status.authRequired ? 'auth_required' : status.organizationRequired ? 'organization_required' : status.reason,
    'GitHub',
  );
  if (access) return <IntegrationItem {...github} description={access} />;
  if (!status.enabled && !status.connected) return <NotConfiguredRow {...github} />;
  if (!status.connected) {
    return (
      <IntegrationItem {...github}>
        <GithubConnectButton />
      </IntegrationItem>
    );
  }
  return (
    <IntegrationItem
      {...github}
      description={
        status.installations
          .map(installation => installation.accountLogin || `Installation ${installation.installationId}`)
          .join(', ') || undefined
      }
    >
      <GithubManageButton />
    </IntegrationItem>
  );
}

function GitLabConnectionRows() {
  const query = useGitLabStatusQuery();
  const status = query.data;
  const gitlab = platformIntegration('gitlab');

  if (query.isPending) return <SettingsRowsSkeleton label="Loading GitLab connections" rows={1} />;
  if (query.isError || status?.reason === 'unavailable') {
    return (
      <RetryRow
        label={gitlab.name}
        provider={gitlab.provider}
        errorMsg="Couldn't load GitLab connections."
        onRetry={() => void query.refetch()}
      />
    );
  }
  const access = accessDescription(status?.reason, 'GitLab');
  if (access) return <IntegrationItem {...gitlab} description={access} />;
  if (status?.mode === 'direct' && status.enabled && status.configured) {
    return <IntegrationItem {...gitlab} description="Managed by deployment environment variables." />;
  }
  if (status?.mode !== 'platform') return <NotConfiguredRow {...gitlab} />;
  const connections = status.connections ?? [];
  if (connections.length === 0) {
    return (
      <IntegrationItem {...gitlab}>
        <PlatformConnectButton provider="gitlab" />
      </IntegrationItem>
    );
  }
  return (
    <>
      {connections.map((connection, index) => {
        const needsReauth = connection.status === 'needs_reauth';
        const last = index === connections.length - 1;
        return (
          <IntegrationItem
            key={connection.id}
            {...gitlab}
            description={connectionName(connection)}
            error={needsReauth ? 'Needs reauthorization' : undefined}
          >
            {needsReauth || last ? (
              <>
                {needsReauth && <PlatformReconnectButton provider="gitlab" connectionId={connection.id} />}
                {last && <PlatformManageLink provider="gitlab" />}
              </>
            ) : undefined}
          </IntegrationItem>
        );
      })}
      <AddPlatformAccountRow provider="gitlab" />
    </>
  );
}
