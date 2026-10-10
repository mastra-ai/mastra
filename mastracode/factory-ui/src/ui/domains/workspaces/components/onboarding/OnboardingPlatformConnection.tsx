import { Button } from '@mastra/playground-ui/components/Button';
import { usePlatformConnectionsQuery } from '../../../../../hooks/usePlatformConnections';
import { isPlatformConnectUnavailableError } from '../../../factory/services/platformConnect';
import { ProviderConnectControl } from '../../../settings/components/PlatformProviderConnections';
import { IncidentIoIcon, JiraIcon } from '../../../../ui/icons';
import { SkeletonRows } from '../../../../ui/SkeletonRows';
import { OnboardingConnectionRow } from './OnboardingConnectionRow';

const PLATFORMS = {
  jira: { name: 'Jira', Icon: JiraIcon, purpose: 'Issues and priorities for your work board.' },
  'incident-io': {
    name: 'incident.io',
    Icon: IncidentIoIcon,
    purpose: 'Bring incident follow-ups into your work board.',
  },
};

export function OnboardingPlatformConnection({ provider }: { provider: 'jira' | 'incident-io' }) {
  const query = usePlatformConnectionsQuery(provider);
  const { name, Icon, purpose } = PLATFORMS[provider];
  if (query.isPending)
    return <SkeletonRows label={`Loading ${name} connections`} rows={1} rowClassName="h-22 w-full" />;
  if (isPlatformConnectUnavailableError(query.error)) return null;
  const active = query.data?.filter(connection => connection.status === 'active') ?? [];
  if (active.length) {
    const description =
      active.length === 1 ? `Connected to ${active[0]?.accountLabel ?? name}.` : `${active.length} accounts connected.`;
    return (
      <OnboardingConnectionRow compact icon={<Icon />} name={`${name} connected`} connected description={description} />
    );
  }
  if (query.isError) {
    return (
      <OnboardingConnectionRow
        compact
        icon={<Icon />}
        name={name}
        description={`Couldn't load ${name} connections.`}
        action={
          <Button variant="ghost" size="sm" aria-label={`Retry ${name}`} onClick={() => void query.refetch()}>
            Retry
          </Button>
        }
      />
    );
  }
  const reconnect = query.data?.find(connection => connection.status === 'needs_reauth');
  const action = reconnect ? 'Reconnect' : 'Connect';
  const description = reconnect ? 'Reconnect to restore access.' : purpose;
  return (
    <OnboardingConnectionRow
      compact
      icon={<Icon />}
      name={name}
      description={description}
      action={
        <ProviderConnectControl
          provider={provider}
          label={`${action} ${name}`}
          buttonLabel={action}
          reconnectConnectionId={reconnect?.id}
          size="sm"
        />
      }
    />
  );
}
