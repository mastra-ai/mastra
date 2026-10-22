import { Badge } from '../../Badge';
import { getWorkflowCardBadge } from './workflow-card-kind';
import type { WorkflowTypeBadgeProps } from './workflow-card-kind';

export function WorkflowTypeBadge(props: WorkflowTypeBadgeProps) {
  const { label, Icon, tone } = getWorkflowCardBadge(props);
  return (
    <Badge size="xs" variant={tone} icon={<Icon aria-hidden />}>
      {label}
    </Badge>
  );
}
