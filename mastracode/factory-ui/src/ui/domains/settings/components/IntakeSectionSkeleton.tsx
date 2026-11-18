import { SkeletonText } from '@mastra/playground-ui/components/Skeleton';
import { SettingsContainer, SettingsSkeleton } from '@mastra/playground-ui/new/settings';

import { IntakeProviderSummary } from './IntakeProviderCard';
import type { IntakeProvider } from './IntakeProviderCard';

const ALWAYS_SHOWN_PROVIDERS: IntakeProvider[] = ['github', 'gitlab', 'linear', 'jira'];

export function IntakeSourcesSkeleton() {
  return (
    <>
      {ALWAYS_SHOWN_PROVIDERS.map(provider => (
        <SettingsContainer key={provider}>
          <IntakeProviderSummary
            provider={provider}
            details={
              <span aria-hidden>
                <SkeletonText line="text-caption" className="w-48 max-w-full motion-reduce:before:animate-none" />
              </span>
            }
          />
        </SettingsContainer>
      ))}
      <SettingsContainer aria-hidden>
        <SettingsSkeleton label="Loading intake source" variant="item" rows={1} />
      </SettingsContainer>
    </>
  );
}
