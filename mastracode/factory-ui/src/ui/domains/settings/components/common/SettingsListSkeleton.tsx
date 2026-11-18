import { SkeletonText } from '@mastra/playground-ui/components/Skeleton';
import { SettingsContainer, SettingsListHeader, SettingsSkeleton } from '@mastra/playground-ui/new/settings';
import type { ReactNode } from 'react';

export function SettingsListSkeleton({ label, rows, action }: { label: string; rows?: number; action: ReactNode }) {
  return (
    <SettingsContainer>
      <SettingsListHeader aria-hidden action={action}>
        <SkeletonText line="text-label" className="w-24 motion-reduce:before:animate-none" />
      </SettingsListHeader>
      <SettingsSkeleton label={label} variant="item" rows={rows} />
    </SettingsContainer>
  );
}
