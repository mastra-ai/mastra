'use client';

import { format } from 'date-fns';

import { cn } from '@/lib/utils';

import type { RevisionListItemProps } from './types';

export function RevisionListItem({ revision, onClick }: RevisionListItemProps) {
  const truncatedId = revision.id.length > 8 ? `${revision.id.slice(0, 8)}...` : revision.id;
  const formattedDate = format(new Date(revision.publicationDate), 'MMM d, yyyy h:mm a');

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center gap-3 w-full p-3 rounded-md text-left',
        'bg-surface2 hover:bg-surface3 transition-colors',
        'border border-border1 hover:border-accent1',
      )}
    >
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className="text-ui-sm font-medium text-neutral5 truncate">{truncatedId}</span>
        <span className="text-ui-sm text-neutral3">{formattedDate}</span>
      </div>
    </button>
  );
}
