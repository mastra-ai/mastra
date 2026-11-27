import type { ReactNode } from 'react';

import { DEFAULTS_CONTENT_CLASS, DEFAULTS_HEADER_CLASS, DefaultsIdentity } from './defaults-card';
import { ModelPackListSkeleton } from './model-pack-list-skeleton';
import type { ModelDefaults } from './model-routes';
import { Skeleton } from '@/ds/components/Skeleton';
import { SettingsContainer } from '@/ds/new/settings';

const DEFAULTS: ModelDefaults[] = ['personal', 'factory'];

export function ModelRoutingSkeleton({ providers }: { providers?: ReactNode }) {
  return (
    <div role="status" aria-label="Loading model defaults" className="flex flex-col gap-3">
      {DEFAULTS.map(defaults => (
        <SettingsContainer key={defaults} aria-hidden>
          <section>
            <header className={DEFAULTS_HEADER_CLASS}>
              <DefaultsIdentity defaults={defaults} />
              <Skeleton className="ml-auto h-6 w-28 rounded-md motion-reduce:before:animate-none" />
            </header>
            <div className={DEFAULTS_CONTENT_CLASS}>
              <ModelPackListSkeleton label="Loading model packs" />
              {providers && (
                <>
                  <hr className="h-px border-0 bg-border" />
                  {providers}
                </>
              )}
            </div>
          </section>
        </SettingsContainer>
      ))}
    </div>
  );
}
