import { Button } from '@mastra/playground-ui/components/Button';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@mastra/playground-ui/components/Select';
import { Switch } from '@mastra/playground-ui/components/Switch';
import { toast } from '@mastra/playground-ui/components/Toaster';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useParams } from 'react-router';

import { useApiConfig } from '../../api/config';
import {
  useChannelAccountsQuery,
  useDisconnectChannelAccountMutation,
  useSetDefaultFactoryMutation,
} from '../../hooks/useChannelAccounts';
import { useSetFactorySlackWorkItemsMutation } from '../../hooks/useFactorySlackWorkItems';
import { useFactoriesQuery } from '../../hooks/useFactories';
import { ConnectionSettingsShell } from '../domains/settings/components/ConnectionSettingsShell';
import { SettingsCard, SettingsRow } from '../domains/settings/components/SettingsCard';
import { SettingsSubsection } from '../domains/settings/components/SettingsSubsection';
import { SlackLogo } from '../domains/settings/components/SlackLogo';
import { connectSlackUrl, type ConnectedChannelAccount } from '../domains/settings/services/channelAccounts';
import { SettingsPageLayout } from './SettingsPage';

const linkedDateFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'long',
  timeStyle: 'short',
});

export function SlackConnectionPage() {
  return (
    <SettingsPageLayout>
      <SlackConnectionSettings />
    </SettingsPageLayout>
  );
}

export function SlackConnectionSettings() {
  const { factoryId } = useParams<{ factoryId: string }>();
  const { baseUrl } = useApiConfig();
  const accountsQuery = useChannelAccountsQuery();
  const factoriesQuery = useFactoriesQuery();
  const disconnectMutation = useDisconnectChannelAccountMutation();
  const setDefaultFactoryMutation = useSetDefaultFactoryMutation();
  const slackWorkItemsMutation = useSetFactorySlackWorkItemsMutation(factoryId);

  const accounts = accountsQuery.data?.accounts.filter(candidate => candidate.platform === 'slack') ?? [];
  const canConnect = accountsQuery.data?.canConnect ?? false;
  const factories = factoriesQuery.data ?? [];
  const factory = factories.find(candidate => candidate.id === factoryId);

  const connectSlack = () => {
    window.location.assign(connectSlackUrl(baseUrl));
  };

  const disconnect = (account: ConnectedChannelAccount) => {
    disconnectMutation.mutate(
      {
        platform: account.platform,
        externalTeamId: account.externalTeamId,
        externalUserId: account.externalUserId,
      },
      {
        onSuccess: deleted => {
          if (deleted) toast.success('Disconnected Slack account');
          else toast.error('Account was already disconnected');
        },
        onError: error => toast.error(error instanceof Error ? error.message : 'Failed to disconnect account'),
      },
    );
  };

  const setDefaultFactory = (account: ConnectedChannelAccount, factoryProjectId: string) => {
    setDefaultFactoryMutation.mutate(
      {
        platform: account.platform,
        externalTeamId: account.externalTeamId,
        externalUserId: account.externalUserId,
        factoryProjectId,
      },
      {
        onSuccess: () => {
          const name = factories.find(factory => factory.id === factoryProjectId)?.name ?? factoryProjectId;
          toast.success(`Slack sessions will go to ${name}`);
        },
        onError: error => toast.error(error instanceof Error ? error.message : 'Failed to set default factory'),
      },
    );
  };

  return (
    <ConnectionSettingsShell
      backLabel="Back to connections"
      backTo={factoryId ? `/factories/${factoryId}/settings/connections` : '/'}
      title={
        <span className="flex items-center gap-3">
          <SlackLogo className="size-6" />
          Slack
        </span>
      }
      description="Start and continue Factory sessions from Slack."
    >
      {accountsQuery.isPending ? (
        <Txt as="p" variant="ui-sm" role="status" className="text-icon3">
          Loading Slack connection…
        </Txt>
      ) : accountsQuery.error ? (
        <Txt as="p" variant="ui-sm" className="text-notice-destructive-fg">
          {accountsQuery.error instanceof Error ? accountsQuery.error.message : 'Failed to load Slack connection'}
        </Txt>
      ) : accounts.length === 0 ? (
        <SettingsSubsection title="Connection">
          <SettingsCard>
            <SettingsRow label="Slack" hint={canConnect ? 'Not connected' : 'Slack connection is not configured'}>
              <Button variant="outline" size="sm" disabled={!canConnect} onClick={connectSlack}>
                Connect Slack
              </Button>
            </SettingsRow>
          </SettingsCard>
        </SettingsSubsection>
      ) : (
        <div className="flex flex-col gap-8">
          <SettingsSubsection title={accounts.length === 1 ? 'Connection' : 'Connections'}>
            <div className="flex flex-col gap-4">
              {accounts.map(account => (
                <SettingsCard key={`${account.externalTeamId}:${account.externalUserId}`}>
                  <SettingsRow
                    label="Workspace"
                    hint={`${account.externalTeamName ?? 'Slack workspace'} (${account.externalTeamId})`}
                  />
                  <SettingsRow
                    label="Slack account"
                    hint={`${account.externalUserName ?? account.externalUserId} (${account.externalUserId})`}
                  />
                  <SettingsRow label="Connected" hint={linkedDateFormatter.format(new Date(account.linkedAt))} />
                  <SettingsRow label="Default factory" hint="New Slack sessions are routed to this Factory.">
                    <Select
                      value={account.defaultFactoryProjectId ?? ''}
                      disabled={factories.length === 0 || setDefaultFactoryMutation.isPending}
                      onValueChange={factoryProjectId => setDefaultFactory(account, factoryProjectId)}
                    >
                      <SelectTrigger
                        variant="outline"
                        size="sm"
                        aria-label={`Default factory for ${account.externalUserName ?? account.externalUserId}`}
                        className="w-auto"
                      >
                        <Txt as="span" variant="ui-sm">
                          {factories.find(factory => factory.id === account.defaultFactoryProjectId)?.name ??
                            'Set default factory'}
                        </Txt>
                      </SelectTrigger>
                      <SelectContent>
                        {factories.map(factory => (
                          <SelectItem key={factory.id} value={factory.id}>
                            {factory.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </SettingsRow>
                </SettingsCard>
              ))}
            </div>
          </SettingsSubsection>

          <SettingsSubsection title="Session behavior">
            <SettingsCard>
              <SettingsRow
                label="Create work items for new Slack threads"
                hint="Add new Slack thread sessions to this Factory's Work board in Building."
              >
                <Switch
                  aria-label="Create work items for new Slack threads"
                  checked={factory?.slackWorkItemsEnabled ?? false}
                  disabled={!factoryId || factoriesQuery.isPending || slackWorkItemsMutation.isPending}
                  onCheckedChange={enabled =>
                    slackWorkItemsMutation.mutate(enabled, {
                      onSuccess: () => toast.success('Slack session behavior updated'),
                      onError: error =>
                        toast.error(error instanceof Error ? error.message : 'Failed to update Slack session behavior'),
                    })
                  }
                />
              </SettingsRow>
            </SettingsCard>
          </SettingsSubsection>

          <SettingsSubsection title="Danger zone">
            <SettingsCard>
              {accounts.map(account => (
                <SettingsRow
                  key={`${account.externalTeamId}:${account.externalUserId}`}
                  label="Disconnect Slack"
                  hint="Slack messages will no longer run as your Mastra account."
                >
                  <Button
                    variant="outline"
                    size="sm"
                    aria-label={`Disconnect ${account.externalUserName ?? account.externalUserId}`}
                    disabled={disconnectMutation.isPending}
                    onClick={() => disconnect(account)}
                  >
                    {disconnectMutation.isPending ? 'Disconnecting…' : 'Disconnect'}
                  </Button>
                </SettingsRow>
              ))}
            </SettingsCard>
          </SettingsSubsection>
        </div>
      )}
    </ConnectionSettingsShell>
  );
}
