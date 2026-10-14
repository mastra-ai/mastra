import { cn } from '@/lib/utils';

export interface DataPanelHeaderProps {
  className?: string;
  children: React.ReactNode;
}

export function DataPanelHeader({ className, children }: DataPanelHeaderProps) {
  return (
    <div
      className={cn(
        // Same box as the app `Header`. Leading `CloseButton`, then the heading
        // (+ inline metadata via `HeaderContent`), then `HeaderActions` pushed to the right edge.
        // `flex-wrap` drops the actions onto a second row when the panel is too narrow for one.
        // `gap-0.5` is the slight gap between the close arrow and the heading.
        'flex min-h-header-default w-full flex-wrap items-center gap-0.5 px-2 py-1.5',
        // Bottom border only when something follows the header (i.e. the panel is expanded).
        // When the panel is collapsed and the header is the only child, the border auto-hides.
        'not-last:border-b not-last:border-border',
        className,
      )}
    >
      {children}
    </div>
  );
}
