import { Skeleton, SkeletonText } from '@mastra/playground-ui/components/Skeleton';
import type { ReactNode } from 'react';

import { DRAWER_SOURCE_ROW, SELECTED_SOURCE_ROW, SOURCE_SUMMARY, SOURCE_SUMMARY_TEXT } from './sourcePickerLayout';

function SourceRowSkeleton({ className, icon }: { className: string; icon?: ReactNode }) {
  return (
    <div aria-hidden className={className}>
      <div className={SOURCE_SUMMARY}>
        {icon && <span className="shrink-0">{icon}</span>}
        <div className={SOURCE_SUMMARY_TEXT}>
          <SkeletonText line="text-caption" className="w-40 max-w-full motion-reduce:before:animate-none" />
        </div>
      </div>
      <Skeleton className="h-control-sm ml-auto w-20 rounded-full motion-reduce:before:animate-none" />
    </div>
  );
}

export function SelectedSourcesSkeleton({ label, icon }: { label: string; icon?: ReactNode }) {
  return (
    <div role="status" aria-label={`Loading ${label}`}>
      <SourceRowSkeleton className={SELECTED_SOURCE_ROW} icon={icon} />
    </div>
  );
}

export function DrawerSourcesSkeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-label={`Loading ${label}`}>
      {Array.from({ length: 5 }, (_, index) => (
        <SourceRowSkeleton key={index} className={DRAWER_SOURCE_ROW} />
      ))}
    </div>
  );
}
