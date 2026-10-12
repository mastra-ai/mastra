import { Button } from '@mastra/playground-ui/components/Button';
import { LinearIcon } from '@mastra/playground-ui/icons/LinearIcon';
import { useLinearStatusQuery } from '../../../../../hooks/useLinearData';
import { SkeletonRows } from '../../../../ui/SkeletonRows';
import { OnboardingConnectionRow } from './OnboardingConnectionRow';

export function OnboardingLinearConnection({ onConnect }: { onConnect: () => void }) {
  const query = useLinearStatusQuery();
  if (query.isPending) return <SkeletonRows label="Loading Linear status" rows={1} rowClassName="h-22 w-full" />;
  const status = query.data;
  if (status?.connected)
    return (
      <OnboardingConnectionRow
        compact
        icon={<LinearIcon />}
        name="Linear connected"
        connected
        description={`Connected to ${status.workspace?.name ?? 'Linear'}.`}
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
