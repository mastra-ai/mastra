import { Button } from '@mastra/playground-ui/components/Button';
import { Skeleton, SkeletonText } from '@mastra/playground-ui/components/Skeleton';
import { TrashIcon } from '@mastra/playground-ui/icons/TrashIcon';
import type { ReactNode } from 'react';

import { DRAWER_SOURCE_ROW, SELECTED_SOURCE_ROW, SOURCE_SUMMARY, SOURCE_SUMMARY_TEXT } from './sourcePickerLayout';

function SourceRowSkeleton({ className, icon, action }: { className: string; icon?: ReactNode; action: ReactNode }) {
  return (
    <div aria-hidden className={className}>
      <div className={SOURCE_SUMMARY}>
        {icon && <span className="shrink-0">{icon}</span>}
        <div className={SOURCE_SUMMARY_TEXT}>
          <SkeletonText line="text-caption" className="w-40 max-w-full motion-reduce:before:animate-none" />
        </div>
      </div>
      {action}
    </div>
  );
}

export function SelectedSourcesSkeleton({ label, icon, ids }: { label: string; icon?: ReactNode; ids: string[] }) {
  return (
    <div role="status" aria-label={`Loading ${label}`}>
      {ids.map(id => (
        <SourceRowSkeleton
          key={id}
          className={SELECTED_SOURCE_ROW}
          icon={icon}
          action={
            <Button size="sm" variant="ghost" icon={<TrashIcon />} inert className="ml-auto">
              Remove
            </Button>
          }
        />
      ))}
    </div>
  );
}

export function DrawerSourcesSkeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-label={`Loading ${label}`}>
      {Array.from({ length: 5 }, (_, index) => (
        <SourceRowSkeleton
          key={index}
          className={DRAWER_SOURCE_ROW}
          action={<Skeleton className="h-control-sm ml-auto w-20 rounded-full motion-reduce:before:animate-none" />}
        />
      ))}
    </div>
  );
}
