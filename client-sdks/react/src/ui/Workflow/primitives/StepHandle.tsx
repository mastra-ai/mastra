import { Handle, HandleProps } from '@xyflow/react';
import { twMerge } from 'tailwind-merge';
export type StepHandleProps = HandleProps & { isFinished?: boolean };

export const StepHandleClass =
  'mastra:size-3 mastra:rounded-full mastra:border-1 mastra:!border-border1 mastra:!bg-surface4';
export const StepHandle = ({ className, isFinished, ...props }: StepHandleProps) => {
  return (
    <Handle className={className || twMerge(StepHandleClass, isFinished && 'mastra:!border-accent1')} {...props} />
  );
};
