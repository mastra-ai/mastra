import { Skeleton, SkeletonText } from '@mastra/playground-ui/components/Skeleton';
import { SettingsContainer, SettingsListHeader, SettingsSkeleton } from '@mastra/playground-ui/new/settings';

export function SettingsListSkeleton({ label, rows }: { label: string; rows?: number }) {
  return (
    <SettingsContainer>
      <SettingsListHeader
        aria-hidden
        action={<Skeleton className="h-control-sm w-28 rounded-full motion-reduce:before:animate-none" />}
      >
        <SkeletonText line="text-label" className="w-24 motion-reduce:before:animate-none" />
      </SettingsListHeader>
      <SettingsSkeleton label={label} variant="item" rows={rows} />
    </SettingsContainer>
  );
}
