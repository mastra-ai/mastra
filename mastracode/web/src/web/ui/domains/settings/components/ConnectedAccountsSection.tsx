import { Button } from '@mastra/playground-ui/components/Button';
import { DataList } from '@mastra/playground-ui/components/DataList';
import { toast } from '@mastra/playground-ui/components/Toaster';
import { Txt } from '@mastra/playground-ui/components/Txt';

import { SkeletonRows } from '../../../ui/SkeletonRows';
import {
  useChannelAccountsQuery,
  useDisconnectChannelAccountMutation,
} from '../../../../../shared/hooks/useChannelAccounts';
import type { ConnectedChannelAccount } from '../services/channelAccounts';

const PLATFORM_LABEL: Record<string, string> = {
  slack: 'Slack',
};

function accountLabel(account: ConnectedChannelAccount): string {
  const platform = PLATFORM_LABEL[account.platform] ?? account.platform;
  return `${platform} · ${account.externalUserId} in ${account.externalTeamId}`;
}

/**
 * Settings › General › Connected accounts: the caller's linked channel
 * identities (e.g. Slack sender → this Mastra user). Linking starts from the
 * channel side (the Connect card in Slack); this surface lists the results
 * and offers self-service disconnect.
 */
export function ConnectedAccountsSection() {
  const accountsQuery = useChannelAccountsQuery();
  const disconnectMutation = useDisconnectChannelAccountMutation();

  const accounts = accountsQuery.data ?? [];

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
        onError: error =>
          toast.error(error instanceof Error ? error.message : 'Failed to disconnect account'),
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
      <Txt as="p" variant="ui-sm" className="text-icon3">
        No connected accounts. Message the bot in Slack and follow its Connect link to link your Slack account.
      </Txt>
    );
  }

  return (
    <DataList aria-label="Connected accounts" variant="lined" columns="minmax(0,1fr) auto auto">
      {accounts.map(account => (
        <DataList.RowStatic key={`${account.platform}:${account.externalTeamId}:${account.externalUserId}`}>
          <DataList.NameCell>{accountLabel(account)}</DataList.NameCell>
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
  );
}
