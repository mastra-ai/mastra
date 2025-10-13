import { ElementType } from 'react';
import { WorkflowStatusProvider } from '../context';
import { WorkflowStatusType } from '../types';
import { twMerge } from 'tailwind-merge';

export type StepCardProps = React.HTMLAttributes<HTMLDivElement> & {
  status: WorkflowStatusType;
};
export const StepCardClass = 'mastra:rounded-lg mastra:border mastra:border-border1 mastra:bg-surface4 mastra:w-xs';

export const StepCardBackgrounds: Record<WorkflowStatusType, string> = {
  idle: 'mastra:bg-surface4',
  success: 'mastra:bg-accent1Darker',
  failed: 'mastra:bg-accent2Darker',
  suspended: 'mastra:bg-accent3Darker',
  waiting: 'mastra:bg-accent5Darker',
  running: 'mastra:bg-accent6Darker',
};

export const StepCard = ({ className, status, ...props }: StepCardProps) => {
  return (
    <WorkflowStatusProvider value={status}>
      <div className={className || twMerge(StepCardClass, StepCardBackgrounds[status])} {...props} />
    </WorkflowStatusProvider>
  );
};

export const StepHeaderClass = 'mastra:px-4 mastra:pt-2 mastra:flex mastra:gap-2 mastra:items-center';
export const StepHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => {
  return <div className={className || StepHeaderClass} {...props} />;
};

export const StepTitleClass = 'mastra:text-sm mastra:text-text6 mastra:w-full mastra:truncate';
export const StepTitle = ({
  className,
  as: Root = 'h3',
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { as?: ElementType }) => {
  return <Root className={className || StepTitleClass} {...props} />;
};

export const StepContentClass = 'mastra:px-4 mastra:py-2 mastra:text-text3 mastra:text-sm mastra:truncate';
export const StepContent = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => {
  return <div className={className || StepContentClass} {...props} />;
};
