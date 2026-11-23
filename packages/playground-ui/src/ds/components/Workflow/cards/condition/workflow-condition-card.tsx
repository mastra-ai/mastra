import type { WorkflowConditionCardViewProps } from '../../types';
import { WorkflowConditionCardView } from './workflow-condition-card-view';

export type WorkflowConditionCardProps = Omit<WorkflowConditionCardViewProps, 'type'>;

export function WorkflowConditionCard({ conditions, ...props }: WorkflowConditionCardProps) {
  return <WorkflowConditionCardView {...props} type={conditions[0]?.type} conditions={conditions} />;
}
