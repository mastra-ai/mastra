import { Skeleton, SkeletonText } from '@mastra/playground-ui/components/Skeleton';
import { SettingsRow } from '@mastra/playground-ui/new/settings';

import { SkeletonRows } from './SkeletonRows';

/** Render inside the same SettingsContainer as the loaded rows. */
export function SettingsRowsSkeleton({ label, rows = 2 }: { label: string; rows?: number }) {
  return (
    <SkeletonRows label={label} rows={rows} className="divide-border gap-0 divide-y">
      <SettingsRow
        aria-hidden
        label={<SkeletonText line="text-label" className="w-28 motion-reduce:before:animate-none" />}
        description={<SkeletonText line="text-caption" className="w-48 max-w-full motion-reduce:before:animate-none" />}
      >
        <Skeleton className="h-control-sm w-28 max-w-full rounded-full motion-reduce:before:animate-none" />
      </SettingsRow>
    </SkeletonRows>
  );
}
