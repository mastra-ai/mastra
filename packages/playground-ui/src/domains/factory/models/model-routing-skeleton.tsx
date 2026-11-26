import type { ReactNode } from 'react';

import { DEFAULTS_CONTENT_CLASS, DEFAULTS_HEADER_CLASS, DefaultsIdentity } from './defaults-card';
import { ModelPackListSkeleton } from './model-pack-list-skeleton';
import type { ModelDefaults } from './model-routes';
import { SkeletonText } from '@/ds/components/Skeleton';
import { SettingsContainer } from '@/ds/new/settings';

const DEFAULTS: ModelDefaults[] = ['personal', 'factory'];

export function ModelRoutingSkeleton({ providers }: { providers?: ReactNode }) {
  return (
    <div role="status" aria-label="Loading model defaults" className="flex flex-col gap-3">
      {DEFAULTS.map(defaults => (
        <SettingsContainer key={defaults}>
          <div className={DEFAULTS_HEADER_CLASS}>
            <DefaultsIdentity defaults={defaults} />
            <SkeletonText line="text-caption" className="ml-auto w-20 motion-reduce:before:animate-none" />
          </div>
          <div aria-hidden className={DEFAULTS_CONTENT_CLASS}>
            <ModelPackListSkeleton label="Loading model packs" />
            {providers && (
              <>
                <hr className="h-px border-0 bg-border" />
                {providers}
              </>
            )}
          </div>
        </SettingsContainer>
      ))}
    </div>
  );
}
