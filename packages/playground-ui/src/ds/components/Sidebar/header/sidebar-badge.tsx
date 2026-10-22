import type { ComponentPropsWithoutRef } from 'react';
import { cn } from '../../../../lib/utils';
import { Badge } from '../../Badge';

export type SidebarBadgeProps = ComponentPropsWithoutRef<'span'>;

/**
 * A label next to the brand in the sidebar header, such as `Beta` or `Staging`. A quieter `Badge`:
 * muted text and no inset rim, so it reads as part of the brand rather than as a control.
 */
export function SidebarBadge({ className, ...props }: SidebarBadgeProps) {
  return (
    <Badge
      size="sm"
      className={cn('text-muted-foreground [--inset-highlight:transparent] [--inset-rim:transparent]', className)}
      {...props}
    />
  );
}
