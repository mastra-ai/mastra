import { CircleSlashIcon } from 'lucide-react';
import * as React from 'react';
import { cn } from '@/lib/utils';

export type EmptyStateProps = {
  /** Defaults to a circle-slash icon. Pass `null` to render no icon. */
  iconSlot?: React.ReactNode;
  titleSlot: React.ReactNode;
  descriptionSlot?: React.ReactNode;
  actionSlot?: React.ReactNode;
  className?: string;
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
  /**
   * `inline` (default) renders the block in place.
   * `fill` centers it in the full height of its parent — the parent must have a definite height.
   */
  variant?: 'inline' | 'fill';
};

export function EmptyState({
  iconSlot = <CircleSlashIcon />,
  titleSlot,
  descriptionSlot,
  actionSlot,
  className,
  as: HeadingTag = 'h3',
  variant = 'inline',
}: EmptyStateProps) {
  const content = (
    <div
      className={cn(
        'flex flex-col items-center justify-center px-4 py-6 text-center',
        'transition-opacity duration-normal ease-out-custom',
        className,
      )}
    >
      {iconSlot && <div className="mb-3">{iconSlot}</div>}
      <HeadingTag className="text-subheading text-foreground">{titleSlot}</HeadingTag>
      {descriptionSlot && <p className="mt-1.5 max-w-md text-caption text-muted-foreground">{descriptionSlot}</p>}
      {actionSlot && <div className="mt-4">{actionSlot}</div>}
    </div>
  );

  if (variant === 'fill') {
    return (
      <div data-slot="empty-state-fill" className="flex h-full items-center-safe justify-center-safe">
        {content}
      </div>
    );
  }

  return content;
}
