import { ListTodo } from 'lucide-react';
import { useWorkSourceConnections, WORK_SOURCE_NAME, WORK_SOURCES } from '../../hooks/useWorkSourceConnections';
import { OnboardingReviewRow } from './OnboardingReviewRow';

export function OnboardingWorkReviewRow({ disabled, onEdit }: { disabled: boolean; onEdit: () => void }) {
  const status = useWorkSourceConnections();
  const connected = WORK_SOURCES.filter(source => status[source]).map(source => WORK_SOURCE_NAME[source]);
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
