import { Button } from '@mastra/playground-ui/components/Button';
import { SettingsContainer, SettingsRow } from '@mastra/playground-ui/new/settings';
import { Link2, RotateCcw } from 'lucide-react';
import { Link, useParams } from 'react-router';

import { SkeletonRows } from '../../../ui/SkeletonRows';
import { useApiConfig } from '../../../../api/config';
import { useChannelAccountsQuery } from '../../../../hooks/useChannelAccounts';
import { connectSlackUrl } from '../services/channelAccounts';
import { SettingsIntegrationIcon } from './brand-icons/SettingsIntegrationIcon';
import { ConnectionManagementButton } from './common/ConnectionManagementButton';

const slackLabel = (
  <span className="flex items-center gap-2">
    <SettingsIntegrationIcon provider="slack" />
    Slack
  </span>
);

// Env vars alone do not prove the deployment registers SlackIntegration.
export function SlackNotConfigured() {
  return (
    <SettingsContainer>
      <SlackUnavailableRow />
    </SettingsContainer>
  );
}

function SlackUnavailableRow() {
  return <SettingsRow label={slackLabel} description="Slack is not set up for this factory." />;
}

export function ConnectedAccountsSection() {
  const { factoryId } = useParams<{ factoryId: string }>();
  const { baseUrl } = useApiConfig();
  const accountsQuery = useChannelAccountsQuery();
  const slackAccounts = accountsQuery.data?.accounts.filter(account => account.platform === 'slack') ?? [];
  const canConnect = accountsQuery.data?.canConnect ?? false;

  if (accountsQuery.isPending) {
    return <SkeletonRows label="Loading connected accounts" rows={1} rowClassName="h-16 w-full" />;
  }

  if (accountsQuery.error) {
    return (
      <SettingsRow
        label={slackLabel}
        errorMsg={
          accountsQuery.error instanceof Error ? accountsQuery.error.message : 'Failed to load connected accounts'
        }
      >
        <Button size="sm" icon={<RotateCcw />} onClick={() => void accountsQuery.refetch()}>
          Retry
        </Button>
      </SettingsRow>
    );
  }

  if (accountsQuery.data?.reason === 'not_registered' || accountsQuery.data?.unavailable) {
    return <SlackUnavailableRow />;
  }

  return (
    <>
      {slackAccounts.length > 0 ? (
        slackAccounts.map((account, index) => (
          <SettingsRow
            key={`${account.externalTeamId}:${account.externalUserId}`}
            label={slackLabel}
            description={`${account.externalUserName || account.externalUserId} · ${account.externalTeamName || account.externalTeamId}`}
          >
            {index === 0 && factoryId && (
              <ConnectionManagementButton render={<Link to={`/factories/${factoryId}/settings/connections/slack`} />}>
                Configure Slack
              </ConnectionManagementButton>
            )}
          </SettingsRow>
        ))
      ) : (
        <SettingsRow
          label={slackLabel}
          description={canConnect ? undefined : 'Slack sign-in is not configured on this server.'}
        >
          <Button
            size="sm"
            icon={<Link2 />}
            disabled={!canConnect}
            onClick={() => window.location.assign(connectSlackUrl(baseUrl, factoryId))}
          >
            Connect Slack
          </Button>
        </SettingsRow>
      )}
    </>
  );
}
