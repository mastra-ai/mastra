import { cn } from '@/lib/utils';

export interface DataPanelHeaderProps {
  className?: string;
  children: React.ReactNode;
}

export function DataPanelHeader({ className, children }: DataPanelHeaderProps) {
  return (
    <div
      className={cn(
        // Same box as the app `Header`. Single row: leading `CloseButton`, then the heading
        // (+ inline metadata via `HeaderContent`), then `HeaderActions` pushed to the right edge.
        // `gap-0.5` is the slight gap between the close arrow and the heading.
        'flex min-h-header-default w-full items-center gap-0.5 px-2 py-1.5',
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
