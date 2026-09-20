import { controlSizeClasses } from '@/ds/primitives/control-size';
import { cn } from '@/lib/utils';

export interface DataPanelHeadingProps {
  className?: string;
  children: React.ReactNode;
}

export function DataPanelHeading({ className, children }: DataPanelHeadingProps) {
  return (
    <h3
      className={cn(
        // Same recipe as a current `Crumb` in the page header, with tight horizontal spacing:
        // inline children like `TraceIdButton` carry their own padding, so `gap-1` + `px-1`
        // is enough to keep the title close to the leading close arrow and the inline metadata.
        // `shrink-0`: the heading keeps its text; the inline `Metadata` row is what gets clipped.
        'inline-flex max-w-full min-w-0 shrink-0 items-center gap-1 rounded-full px-1',
        controlSizeClasses.sm,
        'cursor-default font-medium text-neutral6 [&>b]:font-normal [&>b]:text-neutral3',
        className,
      )}
    >
      {children}
    </h3>
  );
}
