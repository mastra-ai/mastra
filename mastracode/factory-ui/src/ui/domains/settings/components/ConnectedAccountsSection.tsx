import { Txt } from '@mastra/playground-ui/components/Txt';
import { ChevronRight } from 'lucide-react';
import { Link, useParams } from 'react-router';

import { SlackLogo } from '../../../ui/SlackLogo';
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
  const slackAccounts = accountsQuery.data?.accounts.filter(account => account.platform === 'slack') ?? [];
  const canConnect = accountsQuery.data?.canConnect ?? false;

  const connectSlack = () => {
    window.location.assign(connectSlackUrl(baseUrl, factoryId));
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

  const slackLabel = (
    <span className="flex items-center gap-3">
      <SlackLogo className="size-7 shrink-0" />
      <span className="flex flex-col gap-0.5">
        <Txt as="span" variant="ui-md">
          Slack
        </Txt>
        <Txt as="span" variant="ui-sm" className={slackAccounts.length > 0 ? 'text-positive1' : 'text-icon3'}>
          {slackAccounts.length > 1
            ? `${slackAccounts.length} connected`
            : slackAccounts.length === 1
              ? 'Connected'
              : 'Not connected'}
        </Txt>
      </span>
    </span>
  );

  return (
    <SettingsCard>
      {slackAccounts.length > 0 && factoryId ? (
        <Link
          to={`/factories/${factoryId}/settings/connections/slack`}
          className="group hover:bg-surface4 focus-visible:ring-accent1 block cursor-pointer rounded-xl outline-hidden transition-colors focus-visible:ring-2"
        >
          <SettingsRow label={slackLabel}>
            <span className="text-ui-sm text-icon4 group-hover:text-icon5 flex items-center gap-2">
              Configure
              <ChevronRight aria-hidden="true" />
            </span>
          </SettingsRow>
        </Link>
      ) : (
        <button
          type="button"
          disabled={!canConnect}
          onClick={connectSlack}
          className="group hover:bg-surface4 focus-visible:ring-accent1 block w-full cursor-pointer rounded-xl text-left outline-hidden transition-colors focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <SettingsRow label={slackLabel}>
            <span className="text-ui-sm text-icon4 group-hover:text-icon5 flex items-center gap-2">
              Connect
              <ChevronRight aria-hidden="true" />
            </span>
          </SettingsRow>
        </button>
      )}
    </SettingsCard>
  );
}
