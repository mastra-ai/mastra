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
        // Same recipe as a current `Crumb` in the page header, so a panel title reads like the
        // route title: the pill box sits on the header `px-2`, like a crumb in the page header.
        'inline-flex max-w-full min-w-0 items-center gap-2 self-start rounded-full px-[.9em]',
        controlSizeClasses.sm,
        'cursor-default font-medium text-neutral6 [&>b]:font-normal [&>b]:text-neutral3',
        className,
      )}
    >
      {children}
    </h3>
  );
}
