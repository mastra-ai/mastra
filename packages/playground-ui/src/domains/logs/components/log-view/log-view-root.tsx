import type { ComponentProps } from 'react';
import { Card } from '@/ds/components/Card';
import { cn } from '@/lib/utils';

export type LogViewRootProps = ComponentProps<typeof Card> & {
  label?: string;
};

export function LogViewRoot({ label = 'Logs', className, children, ...props }: LogViewRootProps) {
  return (
    <div className={cn('flex h-144 min-w-0 flex-col', className)}>
      <Card
        role="region"
        aria-label={label}
        className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
        {...props}
      >
        {children}
      </Card>
    </div>
  );
}
