import { Skeleton, SkeletonText } from '@mastra/playground-ui/components/Skeleton';
import type { ReactNode } from 'react';

import { OnboardingConnectionName, OnboardingConnectionRowLayout } from './OnboardingConnectionRow';

export function OnboardingConnectionSkeleton({ label, icon, name }: { label: string; icon: ReactNode; name: string }) {
  return (
    <div role="status" aria-label={label}>
      <OnboardingConnectionRowSkeleton icon={icon} name={name} />
    </div>
  );
}

export function OnboardingConnectionRowSkeleton({ icon, name }: { icon: ReactNode; name: string }) {
  return (
    <OnboardingConnectionRowLayout
      icon={icon}
      name={<OnboardingConnectionName name={name} />}
      description={
        <span aria-hidden className="mt-1 block">
          <SkeletonText line="text-meta" className="w-4/5 motion-reduce:before:animate-none" />
        </span>
      }
      action={<Skeleton aria-hidden className="h-control-sm w-20 rounded-full motion-reduce:before:animate-none" />}
    />
  );
}
