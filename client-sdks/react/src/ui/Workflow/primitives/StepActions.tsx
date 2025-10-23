import { twMerge } from 'tailwind-merge';
import { useWorkflowStatus } from '../context';
import { WorkflowStatusType } from '../types';

export type StepActionsProps = React.HTMLAttributes<HTMLDivElement>;

export const StepActionsClass =
  'mastra:flex mastra:gap-1 mastra:items-center mastra:px-3 mastra:py-2 mastra:rounded-b-lg';

export const StepActionsBackgrounds: Record<WorkflowStatusType, string> = {
  success: 'mastra:bg-accent1Dark',
  failed: 'mastra:bg-accent2Dark',
  suspended: 'mastra:bg-accent3Dark',
  waiting: 'mastra:bg-accent5Dark',
  running: 'mastra:bg-accent6Dark',
  idle: 'mastra:bg-surface4',
};

export const StepActions = ({ className, ...props }: StepActionsProps) => {
  const status = useWorkflowStatus();
  return <div className={className || twMerge(StepActionsClass, StepActionsBackgrounds[status])} {...props} />;
};
