import { cn } from '@/lib/utils';

export interface PendingIndicatorProps {
  className?: string;
  testId?: string;
}

/**
 * A single dot that fades in and out indefinitely, signalling the agent is
 * working before any visible output has streamed.
 */
export const PendingIndicator = ({ className, testId = 'pending-indicator' }: PendingIndicatorProps) => (
  <div className={cn('flex items-center text-neutral3', className)} data-testid={testId}>
    <span className="size-2 animate-pulse rounded-full bg-neutral3" />
  </div>
);
