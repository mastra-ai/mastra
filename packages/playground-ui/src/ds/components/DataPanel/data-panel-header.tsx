import { cn } from '../../../lib/utils';

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
        // `py-1` keeps 28px controls + border within the 40px min height, so the divider
        // lines up with an adjacent app `Header` instead of sitting 1px lower.
        'flex min-h-header-default w-full flex-wrap items-center gap-0.5 px-2 py-1',
        // Bottom border only when something follows the header (i.e. the panel is expanded).
        // When the panel is collapsed and the header is the only child, the border auto-hides.
        // Same edge color as the app `Header` it docks beside.
        'not-last:border-b not-last:border-surface-rim',
        className,
      )}
    >
      {children}
    </div>
  );
}
