import { SettingsContainer } from '@mastra/playground-ui/new/settings';

import { CustomProvidersSection } from '../CustomProvidersSection';
import { SettingsSubsection } from '../SettingsSubsection';
import { ModelRoutingSection } from './ModelRoutingSection';

export function ModelsSettings({ factoryId }: { factoryId: string }) {
  return (
    <div className="flex flex-col gap-8">
      <ModelRoutingSection factoryId={factoryId} />
      <SettingsSubsection scope="org" title="Custom providers">
        <SettingsContainer className="p-4">
          <CustomProvidersSection />
        </SettingsContainer>
      </SettingsSubsection>
    </div>
  );
}
