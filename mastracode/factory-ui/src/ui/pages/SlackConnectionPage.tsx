import { Breadcrumb, Crumb } from '@mastra/playground-ui/components/Breadcrumb';
import { Button } from '@mastra/playground-ui/components/Button';
import { PageHeader } from '@mastra/playground-ui/components/PageHeader';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@mastra/playground-ui/components/Select';
import { Switch } from '@mastra/playground-ui/components/Switch';
import { toast } from '@mastra/playground-ui/components/Toaster';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { SlackIcon } from '@mastra/playground-ui/icons/SlackIcon';
import { ChevronRight } from 'lucide-react';
import { Link, useParams } from 'react-router';

import { useApiConfig } from '../../api/config';
import {
  useChannelAccountsQuery,
  useDisconnectChannelAccountMutation,
  useSetDefaultFactoryMutation,
} from '../../hooks/useChannelAccounts';
import { useSetFactorySlackWorkItemsMutation } from '../../hooks/useFactorySlackWorkItems';
import { useFactoriesQuery } from '../../hooks/useFactories';
import { IdentityWithTooltip } from '../domains/settings/components/IdentityWithTooltip';
import { SettingsContainer, SettingsRow } from '@mastra/playground-ui/new/settings';

import { SlackNotConfigured } from '../domains/settings/components/ConnectedAccountsSection';
import { SettingsSubsection } from '../domains/settings/components/SettingsSubsection';
import { connectSlackUrl, type ConnectedChannelAccount } from '../domains/settings/services/channelAccounts';
import { SettingsPageLayout } from './SettingsPage';

const linkedDateFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'long',
  timeStyle: 'short',
});

export function SlackConnectionPage() {
  const { factoryId } = useParams();
  return (
    <SettingsPageLayout
      breadcrumbs={
        <Breadcrumb label="Breadcrumb" className="min-w-0 flex-1 overflow-hidden">
          <Crumb as={Link} to={factoryId ? `/factories/${factoryId}/settings/connections` : '/'}>
            Connections
          </Crumb>
          <Crumb as="span" isCurrent>
            Slack
          </Crumb>
        </Breadcrumb>
      }
      header={
        <PageHeader>
          <PageHeader.Icon>
            <SlackIcon />
          </PageHeader.Icon>
          <PageHeader.Title>Slack</PageHeader.Title>
          <PageHeader.Description>Start and continue Factory sessions from Slack.</PageHeader.Description>
        </PageHeader>
      }
    >
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
    window.location.assign(connectSlackUrl(baseUrl, factoryId));
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
    <div className="mt-6 flex flex-col gap-8 pb-5">
      {accountsQuery.isPending ? (
        <Txt as="p" variant="caption" role="status" className="text-muted-foreground">
          Loading Slack connection…
        </Txt>
      ) : accountsQuery.error ? (
        <Txt as="p" variant="caption" className="text-notice-destructive-fg">
          {accountsQuery.error instanceof Error ? accountsQuery.error.message : 'Failed to load Slack connection'}
        </Txt>
      ) : accountsQuery.data?.reason === 'not_registered' || accountsQuery.data?.unavailable ? (
        <SettingsSubsection scope="personal" title="Connection">
          <SlackNotConfigured />
        </SettingsSubsection>
      ) : accounts.length === 0 ? (
        <SettingsSubsection scope="personal" title="Connection">
          <SettingsContainer>
            <button
              type="button"
              disabled={!canConnect}
              onClick={connectSlack}
              className="group hover:bg-fill focus-visible:ring-accent1 block w-full cursor-pointer rounded-xl text-left outline-hidden transition-colors focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <SettingsRow
                label="Slack"
                description={canConnect ? 'Not connected' : 'Slack connection is not configured'}
              >
                <span className="text-caption text-muted-foreground group-hover:text-foreground flex items-center gap-2">
                  Connect Slack
                  <ChevronRight aria-hidden="true" />
                </span>
              </SettingsRow>
            </button>
          </SettingsContainer>
        </SettingsSubsection>
      ) : (
        <div className="flex flex-col gap-8">
          <SettingsSubsection scope="personal" title={accounts.length === 1 ? 'Connection' : 'Connections'}>
            <div className="flex flex-col gap-4">
              {accounts.map(account => (
                <SettingsContainer key={`${account.externalTeamId}:${account.externalUserId}`}>
                  <SettingsRow
                    label={
                      <span className="flex items-center gap-1.5">
                        <IdentityWithTooltip
                          label={account.externalTeamName ?? 'Slack workspace'}
                          idLabel="Workspace ID"
                          id={account.externalTeamId}
                        />
                        <span aria-hidden="true">·</span>
                        <IdentityWithTooltip
                          label={account.externalUserName ?? account.externalUserId}
                          idLabel="Slack user ID"
                          id={account.externalUserId}
                        />
                      </span>
                    }
                    description={
                      <Txt as="span" variant="meta" className="text-placeholder">
                        Connected {linkedDateFormatter.format(new Date(account.linkedAt))}
                      </Txt>
                    }
                  />
                </SettingsContainer>
              ))}
            </div>
          </SettingsSubsection>

          <SettingsSubsection scope="personal" title="Session behavior">
            <SettingsContainer>
              {accounts.map(account => (
                <SettingsRow
                  key={`${account.externalTeamId}:${account.externalUserId}`}
                  label={
                    accounts.length > 1
                      ? `Default factory for ${account.externalUserName ?? account.externalUserId}`
                      : 'Default factory'
                  }
                  description="New Slack sessions are routed to this Factory."
                >
                  <Select
                    value={account.defaultFactoryProjectId ?? ''}
                    disabled={factories.length === 0 || setDefaultFactoryMutation.isPending}
                    onValueChange={factoryProjectId => setDefaultFactory(account, factoryProjectId)}
                  >
                    <SelectTrigger
                      size="sm"
                      aria-label={`Default factory for ${account.externalUserName ?? account.externalUserId}`}
                      className="w-auto"
                    >
                      <Txt as="span" variant="caption">
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
              ))}
            </SettingsContainer>
          </SettingsSubsection>

          <SettingsSubsection scope="factory" title="Work items">
            <SettingsContainer>
              <SettingsRow
                label="Create work items for new Slack threads"
                description="Add new Slack thread sessions to this Factory's Work board in Building."
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
            </SettingsContainer>
          </SettingsSubsection>

          <SettingsSubsection scope="personal" title="Danger zone">
            <SettingsContainer>
              {accounts.map(account => (
                <SettingsRow
                  key={`${account.externalTeamId}:${account.externalUserId}`}
                  label="Disconnect Slack"
                  description={
                    <span>
                      Slack messages from{' '}
                      <strong className="font-medium">
                        <IdentityWithTooltip
                          label={account.externalUserName ?? account.externalUserId}
                          idLabel="Slack user ID"
                          id={account.externalUserId}
                        />
                      </strong>{' '}
                      will no longer start or continue Factory sessions.
                    </span>
                  }
                >
                  <Button
                    size="sm"
                    aria-label={`Disconnect ${account.externalUserName ?? account.externalUserId}`}
                    disabled={disconnectMutation.isPending}
                    onClick={() => disconnect(account)}
                  >
                    {disconnectMutation.isPending ? 'Disconnecting…' : 'Disconnect'}
                  </Button>
                </SettingsRow>
              ))}
            </SettingsContainer>
          </SettingsSubsection>
        </div>
      )}
    </div>
  );
}
