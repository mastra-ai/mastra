import { SettingsContainer } from '@mastra/playground-ui/new/settings';

import { CustomProvidersSection } from '../CustomProvidersSection';
import { SettingsSubsection } from '../SettingsSubsection';
import { VoiceInputSettings } from '../voice/VoiceInputSettings';
import { ModelRoutingSection } from './routing/ModelRoutingSection';

export function ModelsSettings({ factoryId }: { factoryId: string }) {
  return (
    <>
      <ModelRoutingSection factoryId={factoryId} />
      <VoiceInputSettings factoryId={factoryId} />
      <SettingsSubsection scope="org" title="Custom providers" description="OpenAI-compatible endpoints.">
        <SettingsContainer>
          <CustomProvidersSection />
        </SettingsContainer>
      </SettingsSubsection>
    </>
  );
}
