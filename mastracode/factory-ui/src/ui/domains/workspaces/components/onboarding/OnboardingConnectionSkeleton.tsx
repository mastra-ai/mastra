import { Skeleton, SkeletonText } from '@mastra/playground-ui/components/Skeleton';
import type { ReactNode } from 'react';

import { OnboardingConnectionName, OnboardingConnectionRowLayout } from './OnboardingConnectionRow';

export function OnboardingConnectionSkeleton({
  label,
  known,
}: {
  label: string;
  known?: { icon: ReactNode; name: string };
}) {
  return (
    <div role="status" aria-label={label}>
      <OnboardingConnectionRowSkeleton
        icon={known?.icon}
        name={known && <OnboardingConnectionName name={known.name} />}
      />
    </div>
  );
}

export function OnboardingConnectionRowSkeleton({
  icon = <Skeleton className="size-icon-md shrink-0 rounded-full motion-reduce:before:animate-none" />,
  name = (
    <span aria-hidden className="block">
      <SkeletonText line="text-caption" className="w-24 max-w-full motion-reduce:before:animate-none" />
    </span>
  ),
}: {
  icon?: ReactNode;
  name?: ReactNode;
}) {
  return (
    <OnboardingConnectionRowLayout
      icon={icon}
      name={name}
      description={
        <span aria-hidden className="mt-1 block">
          <SkeletonText line="text-meta" className="w-4/5 motion-reduce:before:animate-none" />
        </span>
      }
      action={<Skeleton aria-hidden className="h-control-sm w-20 rounded-full motion-reduce:before:animate-none" />}
    />
  );
}
