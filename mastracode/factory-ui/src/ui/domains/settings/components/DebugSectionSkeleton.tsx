import { SkeletonText } from '@mastra/playground-ui/components/Skeleton';
import { SettingsContainer, SettingsItem } from '@mastra/playground-ui/new/settings';

export function DebugSectionSkeleton() {
  return (
    <SettingsContainer role="status" aria-label="Loading versions">
      {Array.from({ length: 6 }, (_, index) => (
        <SettingsItem
          key={index}
          aria-hidden
          title={<SkeletonText line="text-label" className="w-40 max-w-full motion-reduce:before:animate-none" />}
        >
          <SkeletonText line="text-caption" className="w-12 motion-reduce:before:animate-none" />
        </SettingsItem>
      ))}
    </SettingsContainer>
  );
}
