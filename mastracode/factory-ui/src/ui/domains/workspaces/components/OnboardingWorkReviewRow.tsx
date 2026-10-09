import { ListTodo } from 'lucide-react';
import { useLinearStatusQuery } from '../../../../hooks/useLinearData';
import { usePlatformConnectionsQuery } from '../../../../hooks/usePlatformConnections';
import { OnboardingReviewRow } from './OnboardingReviewRow';

export function OnboardingWorkReviewRow({ disabled, onEdit }: { disabled: boolean; onEdit: () => void }) {
  const linear = useLinearStatusQuery();
  const jira = usePlatformConnectionsQuery('jira');
  const incidents = usePlatformConnectionsQuery('incident-io');
  const connected = [
    linear.data?.connected ? 'Linear' : undefined,
    jira.data?.some(item => item.status === 'active') ? 'Jira' : undefined,
    incidents.data?.some(item => item.status === 'active') ? 'incident.io' : undefined,
  ].filter(Boolean);
  return (
    <OnboardingReviewRow
      icon={<ListTodo />}
      label="Work"
      value={connected.join(', ') || 'Set up later'}
      detail={connected.length ? 'Connected · choose issues after setup' : undefined}
      disabled={disabled}
      onEdit={onEdit}
    />
  );
}
