import { cn } from '@/lib/utils';

export interface DataPanelHeaderProps {
  className?: string;
  children: React.ReactNode;
}

export function DataPanelHeader({ className, children }: DataPanelHeaderProps) {
  return (
    <div
      className={cn(
        // Horizontal padding (not margin) so the bottom border spans the full card width.
        // py is 1px short of `py-3` so 32px buttons + padding + the 1px border still fit in min-h-14,
        // keeping side-by-side headers the same height.
        'flex min-h-14 items-center justify-between gap-2 px-4 py-[11px]',
        // Bottom border only when something follows the header (i.e. the panel is expanded).
        // When the panel is collapsed and the header is the only child, the border auto-hides.
        'not-last:border-b not-last:border-border1',
        className,
      )}
    >
      {children}
    </div>
  );
}
