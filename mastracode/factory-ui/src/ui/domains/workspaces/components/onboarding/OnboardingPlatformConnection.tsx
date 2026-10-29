import { Button } from '@mastra/playground-ui/components/Button';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { usePlatformConnectionsQuery } from '../../../../../hooks/usePlatformConnections';
import { isPlatformConnectUnavailableError } from '../../../factory/services/platformConnect';
import { ProviderConnectControl } from '../../../settings/components/PlatformProviderConnections';
import { IncidentIoIcon, JiraIcon } from '../../../../ui/icons';
import { OnboardingConnectionSkeleton } from './OnboardingConnectionSkeleton';
import { WORK_SOURCE_NAME } from '../../hooks/useWorkSourceConnections';
import { OnboardingConnectionRow } from './OnboardingConnectionRow';

const PLATFORMS = {
  jira: { Icon: JiraIcon, purpose: 'Issues and priorities for your work board.' },
  'incident-io': {
    Icon: IncidentIoIcon,
    purpose: 'Bring incident follow-ups into your work board.',
  },
};

export function OnboardingPlatformConnection({ provider }: { provider: 'jira' | 'incident-io' }) {
  const query = usePlatformConnectionsQuery(provider);
  const name = WORK_SOURCE_NAME[provider];
  const { Icon, purpose } = PLATFORMS[provider];
  if (query.isPending) return <OnboardingConnectionSkeleton label={`Loading ${name} connections`} />;
  if (isPlatformConnectUnavailableError(query.error)) return null;
  const active = query.data?.filter(connection => connection.status === 'active') ?? [];
  if (active.length) {
    const description =
      active.length === 1 ? `Connected to ${active[0]?.accountLabel ?? name}.` : `${active.length} accounts connected.`;
    return (
      <OnboardingConnectionRow
        compact
        icon={<Icon />}
        name={name}
        description={description}
        action={
          <Txt as="span" variant="caption" tone="muted" className="me-3">
            Connected
          </Txt>
        }
      />
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
