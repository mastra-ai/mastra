import type { ReactNode } from 'react';
import { Txt } from '@/ds/components/Txt';
import { cn } from '@/lib/utils';

export function MetricsKpiCardLabel({
  children,
  icon,
  className,
}: {
  children: string;
  /** Optional glyph shown at the far end of the label row (e.g. a lucide icon). */
  icon?: ReactNode;
  className?: string;
}) {
  if (!icon) {
    return (
      <Txt as="span" variant="subheading" tone="ink" className={className}>
        {children}
      </Txt>
    );
  }
  return (
    <span className={cn('flex items-center justify-between gap-2', className)}>
      <Txt as="span" variant="subheading" tone="ink">
        {children}
      </Txt>
      <span aria-hidden className="shrink-0 text-muted-foreground [&>svg]:size-4">
        {icon}
      </span>
    </span>
  );
}
