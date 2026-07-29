import { Button } from '@mastra/playground-ui/components/Button';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { ChevronRight, Slack } from 'lucide-react';
import { Link, useParams } from 'react-router';

import { SkeletonRows } from '../../../ui/SkeletonRows';
import { useApiConfig } from '../../../../api/config';
import { useChannelAccountsQuery } from '../../../../hooks/useChannelAccounts';
import { connectSlackUrl } from '../services/channelAccounts';
import { SettingsCard, SettingsRow } from './SettingsCard';

/** Connected-account overview for the active factory settings surface. */
export function ConnectedAccountsSection() {
  const { factoryId } = useParams<{ factoryId: string }>();
  const { baseUrl } = useApiConfig();
  const accountsQuery = useChannelAccountsQuery();
  const slackAccount = accountsQuery.data?.accounts.find(account => account.platform === 'slack');
  const canConnect = accountsQuery.data?.canConnect ?? false;

  const connectSlack = () => {
    window.location.assign(connectSlackUrl(baseUrl));
  };

  if (accountsQuery.isPending) {
    return <SkeletonRows label="Loading connected accounts" rows={1} rowClassName="h-16 w-full" />;
  }

  if (accountsQuery.error) {
    return (
      <Txt as="p" variant="ui-sm" className="text-notice-destructive-fg">
        {accountsQuery.error instanceof Error ? accountsQuery.error.message : 'Failed to load connected accounts'}
      </Txt>
    );
  }

  return (
    <SettingsCard>
      <SettingsRow
        label={
          <span className="flex items-center gap-3">
            <Slack className="text-icon5 size-5 shrink-0" aria-hidden="true" />
            <span>Slack</span>
          </span>
        }
        hint={
          <Txt as="span" variant="ui-sm" className={slackAccount ? 'text-positive1' : 'text-icon3'}>
            {slackAccount ? 'Connected' : 'Not connected'}
          </Txt>
        }
      >
        {slackAccount && factoryId ? (
          <Button as={Link} to={`/factories/${factoryId}/settings/connected-accounts/slack`} variant="ghost" size="sm">
            Configure
            <ChevronRight aria-hidden="true" />
          </Button>
        ) : (
          <Button variant="outline" size="sm" disabled={!canConnect} onClick={connectSlack}>
            Connect
            <ChevronRight aria-hidden="true" />
          </Button>
        )}
      </SettingsRow>
    </SettingsCard>
  );
}
