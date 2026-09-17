import { cn } from '@/lib/utils';

export interface DataPanelHeaderProps {
  className?: string;
  children: React.ReactNode;
}

export function DataPanelHeader({ className, children }: DataPanelHeaderProps) {
  return (
    <div
      className={cn(
        // Same box as the app `Header`: `items-center` + a column left block (`HeaderContent`)
        // is what centers `HeaderActions` against heading + metadata, not just the heading.
        // `py-1.5` lets a two-line header grow without touching the border.
        'flex min-h-header-default w-full items-center gap-2 px-2 py-1.5',
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
