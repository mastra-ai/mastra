import { Button } from '@mastra/playground-ui/components/Button';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { LinearIcon } from '@mastra/playground-ui/icons/LinearIcon';
import { useLinearStatusQuery } from '../../../../../hooks/useLinearData';
import { OnboardingConnectionSkeleton } from './OnboardingConnectionSkeleton';
import { OnboardingConnectionRow } from './OnboardingConnectionRow';

export function OnboardingLinearConnection({ onConnect }: { onConnect: () => void }) {
  const query = useLinearStatusQuery();
  if (query.isPending) return <OnboardingConnectionSkeleton label="Loading Linear status" />;
  const status = query.data;
  if (status?.connected)
    return (
      <OnboardingConnectionRow
        compact
        icon={<LinearIcon />}
        name="Linear"
        description={`Connected to ${status.workspace?.name ?? 'Linear'}.`}
        action={
          <Txt as="span" variant="caption" tone="muted" className="me-3">
            Connected
          </Txt>
        }
      />
    );
  if (status?.reason === 'missing_config')
    return (
      <OnboardingConnectionRow
        compact
        icon={<LinearIcon />}
        name="Linear"
        description="Unavailable for this deployment."
      />
    );
  if (status?.reason === 'organization_required')
    return (
      <OnboardingConnectionRow
        compact
        icon={<LinearIcon />}
        name="Linear"
        description="Join an organization to connect Linear."
      />
    );
  if (status?.reason === 'auth_required')
    return (
      <OnboardingConnectionRow
        compact
        icon={<LinearIcon />}
        name="Linear"
        description="Authorization expired. Reconnect Linear to continue."
        action={
          <Button size="sm" aria-label="Reconnect Linear" onClick={onConnect}>
            Reconnect
          </Button>
        }
      />
    );
  if (status?.reason === 'not_connected')
    return (
      <OnboardingConnectionRow
        compact
        icon={<LinearIcon />}
        name="Linear"
        description="Issues and priorities for your work board."
        action={
          <Button size="sm" aria-label="Connect Linear" onClick={onConnect}>
            Connect
          </Button>
        }
      />
    );
  return (
    <OnboardingConnectionRow
      compact
      icon={<LinearIcon />}
      name="Linear"
      description="Couldn't load Linear connection."
      action={
        <Button variant="ghost" size="sm" aria-label="Retry Linear" onClick={() => void query.refetch()}>
          Retry
        </Button>
      }
    />
  );
}
