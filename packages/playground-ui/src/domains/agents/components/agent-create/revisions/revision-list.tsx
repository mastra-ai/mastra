'use client';

import { RevisionListItem } from './revision-list-item';
import type { RevisionListProps } from './types';

export function RevisionList({ revisions, onRevisionClick }: RevisionListProps) {
  if (revisions.length === 0) {
    return <p className="text-ui-sm text-neutral3 text-center py-4">No revisions available</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {revisions.map(revision => (
        <RevisionListItem key={revision.id} revision={revision} onClick={() => onRevisionClick(revision)} />
      ))}
    </div>
  );
}
