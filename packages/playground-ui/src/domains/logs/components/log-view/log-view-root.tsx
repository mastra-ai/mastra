import type { ComponentProps } from 'react';
import { Card } from '@/ds/components/Card';
import { cn } from '@/lib/utils';

export type LogViewHeight = 'fixed' | 'fill';

export type LogViewRootProps = ComponentProps<typeof Card> & {
  label?: string;
  height?: LogViewHeight;
};

const heightClass: Record<LogViewHeight, string> = {
  fixed: 'h-144',
  fill: 'h-full',
};

export function LogViewRoot({ label = 'Logs', height = 'fixed', className, children, ...props }: LogViewRootProps) {
  return (
    <div className={cn('flex min-w-0 flex-col', heightClass[height], className)}>
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
