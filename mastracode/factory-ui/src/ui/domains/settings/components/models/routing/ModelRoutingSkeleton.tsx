import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { SettingsContainer } from '@mastra/playground-ui/new/settings';

import { ModelPackListSkeleton } from '../packs/ModelPackListSkeleton';
import { ProviderRowsSkeleton } from '../providers/ProviderRows';
import { DEFAULTS_CONTENT_CLASS, DEFAULTS_HEADER_CLASS, DefaultsIdentity } from './DefaultsCard';
import type { ModelDefaults } from './model-routes';

const DEFAULTS: ModelDefaults[] = ['personal', 'factory'];

export function ModelRoutingSkeleton() {
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
              <hr className="border-border1" />
              <ProviderRowsSkeleton />
            </div>
          </section>
        </SettingsContainer>
      ))}
    </div>
  );
}
