import { Button } from '@mastra/playground-ui/components/Button';
import { DataList } from '@mastra/playground-ui/components/DataList';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@mastra/playground-ui/components/Select';
import { toast } from '@mastra/playground-ui/components/Toaster';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { Slack } from 'lucide-react';

import { SkeletonRows } from '../../../ui/SkeletonRows';
import { useApiConfig } from '../../../../../shared/api/config';
import {
  useChannelAccountsQuery,
  useDisconnectChannelAccountMutation,
  useSetDefaultFactoryMutation,
} from '../../../../../shared/hooks/useChannelAccounts';
import { useFactoriesQuery } from '../../../../../shared/hooks/useFactories';
import { connectSlackUrl } from '../services/channelAccounts';
import type { ConnectedChannelAccount } from '../services/channelAccounts';

const PLATFORM_LABEL: Record<string, string> = {
  slack: 'Slack',
};

function accountLabel(account: ConnectedChannelAccount): string {
  const platform = PLATFORM_LABEL[account.platform] ?? account.platform;
  // Prefer the display names captured at link time; ids are the fallback for
  // links written before names existed (or via the nameless legacy card path).
  const user = account.externalUserName ?? account.externalUserId;
  const team = account.externalTeamName ?? account.externalTeamId;
  return `${platform} · ${user} in ${team}`;
}

/**
 * Settings › General › Connected accounts: the caller's linked channel
 * identities (e.g. Slack sender → this Mastra user). Linking starts from the
 * channel side (the Connect card in Slack); this surface lists the results
 * and offers self-service disconnect.
 */
export function ConnectedAccountsSection() {
  const { baseUrl } = useApiConfig();
  const accountsQuery = useChannelAccountsQuery();
  const disconnectMutation = useDisconnectChannelAccountMutation();
  const setDefaultFactoryMutation = useSetDefaultFactoryMutation();
  const factoriesQuery = useFactoriesQuery();

  const accounts = accountsQuery.data?.accounts ?? [];
  const canConnect = accountsQuery.data?.canConnect ?? false;
  const factories = factoriesQuery.data ?? [];

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

  // Full-page navigation: the server route redirects out to Slack's consent
  // screen and back, so this can't be an XHR.
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
          if (deleted) toast.success(`Disconnected ${PLATFORM_LABEL[account.platform] ?? account.platform} account`);
          else toast.error('Account was already disconnected');
        },
        onError: error => toast.error(error instanceof Error ? error.message : 'Failed to disconnect account'),
      },
    );
  };

  const isDisconnecting = (account: ConnectedChannelAccount) =>
    disconnectMutation.isPending &&
    disconnectMutation.variables?.platform === account.platform &&
    disconnectMutation.variables?.externalTeamId === account.externalTeamId &&
    disconnectMutation.variables?.externalUserId === account.externalUserId;

  if (accountsQuery.isPending) {
    return <SkeletonRows label="Loading connected accounts" rows={2} rowClassName="h-9 w-full" />;
  }

  if (accountsQuery.error) {
    return (
      <Txt as="p" variant="ui-sm" className="text-notice-destructive-fg">
        {accountsQuery.error instanceof Error ? accountsQuery.error.message : 'Failed to load connected accounts'}
      </Txt>
    );
  }

  if (accounts.length === 0) {
    return (
      <div className="flex flex-col items-start gap-3">
        <Txt as="p" variant="ui-sm" className="text-icon3">
          {canConnect
            ? 'No connected accounts. Connect your Slack account so messages you send the bot in Slack run with your credentials.'
            : 'No connected accounts. Message the bot in Slack and follow its Connect link to link your Slack account.'}
        </Txt>
        {canConnect && (
          <Button variant="outline" size="sm" onClick={connectSlack}>
            <Slack className="size-3" aria-hidden="true" />
            Connect Slack
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start gap-3">
      <DataList aria-label="Connected accounts" variant="lined" columns="minmax(0,1fr) auto auto auto">
        {accounts.map(account => (
          <DataList.RowStatic key={`${account.platform}:${account.externalTeamId}:${account.externalUserId}`}>
            <DataList.NameCell>{accountLabel(account)}</DataList.NameCell>
            <DataList.Cell>
              {/* Which factory this sender's Slack sessions go to. Empty until
                  picked (or auto-stamped by the first single-factory run). */}
              <Select
                value={account.defaultFactoryProjectId ?? ''}
                disabled={factories.length === 0 || setDefaultFactoryMutation.isPending}
                onValueChange={factoryProjectId => setDefaultFactory(account, factoryProjectId)}
              >
                <SelectTrigger
                  variant="ghost"
                  size="xs"
                  aria-label={`Default factory for ${accountLabel(account)}`}
                  className="w-auto"
                >
                  <Txt as="span" variant="ui-xs" className="text-icon3">
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
            </DataList.Cell>
            <DataList.Cell>
              <Txt as="span" variant="ui-xs" className="text-icon3">
                Linked {new Date(account.linkedAt).toLocaleDateString()}
              </Txt>
            </DataList.Cell>
            <DataList.Cell className="justify-end">
              <Button
                variant="outline"
                size="sm"
                aria-label={`Disconnect ${accountLabel(account)}`}
                disabled={isDisconnecting(account)}
                onClick={() => disconnect(account)}
              >
                {isDisconnecting(account) ? 'Disconnecting…' : 'Disconnect'}
              </Button>
            </DataList.Cell>
          </DataList.RowStatic>
        ))}
      </DataList>
      {canConnect && (
        <Button variant="outline" size="sm" onClick={connectSlack}>
          <Slack className="size-3" aria-hidden="true" />
          Connect another Slack account
        </Button>
      )}
    </div>
  );
}
