import { SettingsContainer } from '@mastra/playground-ui/new/settings';

import type { AvailableModelOption } from '../../../../hooks/useAvailableModels';
import { useProviderConnectionState } from '../hooks/useProviderConnectionState';
import { ModelPacksSection } from './ModelPacksSection';
import { ProviderAccessSection } from './ProviderAccessSection';
import { SettingsSubsection } from './SettingsSubsection';

export function PersonalModelsSettings({ models }: { models: AvailableModelOption[] }) {
  const { anyConnected, providersKnown } = useProviderConnectionState();

  return (
    <div className="flex flex-col gap-8">
      {(!providersKnown || anyConnected) && (
        <SettingsSubsection
          scope="personal"
          id="model-packs"
          title="Your defaults"
          description="The pack you run with. Creating or removing a pack changes the list for your whole org."
        >
          <SettingsContainer>
            <div className="p-4">
              <ModelPacksSection models={models} />
            </div>
          </SettingsContainer>
        </SettingsSubsection>
      )}
      <ProviderAccessSection
        fixedScope="user"
        showOrgCoverage
        description="Connect your own provider account for interactive chats. Organization credentials are managed in Factory settings."
      />
    </div>
  );
}
