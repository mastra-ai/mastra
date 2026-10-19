import { controlSizeClasses } from '@/ds/primitives/control-size';
import { cn } from '@/lib/utils';

export interface DataPanelHeadingProps {
  className?: string;
  children: React.ReactNode;
}

export function DataPanelHeading({ className, children }: DataPanelHeadingProps) {
  return (
    <h3
      data-slot="data-panel-heading"
      className={cn(
        // Same recipe as a current `Crumb` in the page header, with tight horizontal spacing:
        // inline children like `TraceIdButton` carry their own padding, so `gap-1` + `px-1`
        // is enough to keep the title close to the leading close arrow and the inline metadata.
        // `shrink-0`: the heading keeps its text; the inline `Metadata` row is what gets clipped.
        'inline-flex max-w-full min-w-0 shrink-0 items-center gap-1 rounded-full px-1',
        // Header wrapped: the heading fills the first row up to the actions, and a long ID is cut off before it reaches them.
        'group-data-wrapped/data-panel-header:flex-1 group-data-wrapped/data-panel-header:overflow-hidden',
        'group-data-wrapped/data-panel-header:*:min-w-0 group-data-wrapped/data-panel-header:*:shrink group-data-wrapped/data-panel-header:*:overflow-hidden',
        controlSizeClasses.sm,
        'cursor-default text-foreground [&>b]:text-caption [&>b]:text-muted-foreground',
        className,
      )}
    >
      {children}
    </h3>
  );
}
