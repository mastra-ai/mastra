import type { VisibilityValue } from '@mastra/client-js';
import { GlobeIcon, LockIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

export interface VisibilityBadgeProps {
  visibility: VisibilityValue | undefined;
  showLabel?: boolean;
  className?: string;
}

/**
 * Compact lock/globe indicator for private vs. public marketplace items.
 * Treats `undefined` as 'private' — new records default to private.
 */
export function VisibilityBadge({ visibility, showLabel = false, className }: VisibilityBadgeProps) {
  const isPublic = visibility === 'public';
  const label = isPublic ? 'Public' : 'Private';
  const Icon = isPublic ? GlobeIcon : LockIcon;

  return (
    <span
      title={isPublic ? 'Visible to your team in the Marketplace' : 'Only visible to you and admins'}
      data-visibility={isPublic ? 'public' : 'private'}
      className={cn(
        'inline-flex items-center gap-1 text-xs text-icon4',
        isPublic ? 'text-accent1' : 'text-icon3',
        className,
      )}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {showLabel ? <span>{label}</span> : <span className="sr-only">{label}</span>}
    </span>
  );
}
