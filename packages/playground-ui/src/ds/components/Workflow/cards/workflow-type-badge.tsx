import { getWorkflowCardBadge } from './workflow-card-kind';
import type { WorkflowTypeBadgeProps } from './workflow-card-kind';
import { Badge } from '@/ds/components/Badge';

export function WorkflowTypeBadge(props: WorkflowTypeBadgeProps) {
  const { label, Icon, tone } = getWorkflowCardBadge(props);
  return (
    <Badge size="xs" variant={tone} icon={<Icon aria-hidden />}>
      {label}
    </Badge>
  );
}
