import { Skeleton, SkeletonText } from '@mastra/playground-ui/components/Skeleton';
import { cn } from '@mastra/playground-ui/utils/cn';
import type { ReactNode } from 'react';

const BAR = 'motion-reduce:before:animate-none';

export function PendingValue() {
  return (
    <span aria-hidden className="flex">
      <SkeletonText line="text-body-sm" className={cn('w-28 max-w-full', BAR)} />
    </span>
  );
}

export function PendingField({
  pending = true,
  children,
  multiline = false,
  className,
}: {
  pending?: boolean;
  children: ReactNode;
  multiline?: boolean;
  className?: string;
}) {
  return (
    <div inert={pending} aria-busy={pending} className={cn('relative min-w-0', className)}>
      {children}
      {pending && (
        <span
          className={cn(
            'pointer-events-none absolute inset-x-0 flex',
            multiline ? 'top-0' : 'inset-y-0 items-center ps-3 pe-10',
          )}
        >
          <PendingValue />
        </span>
      )}
    </div>
  );
}

export function PendingSwitch() {
  return <Skeleton aria-hidden className={cn('h-5 w-9 shrink-0 rounded-full', BAR)} />;
}
