import { SettingsContainer } from '@mastra/playground-ui/new/settings';

import { usePersonalAvailableModelsQuery } from '../../../../hooks/useAvailableModels';
import { useProviderConnectionState } from '../hooks/useProviderConnectionState';
import { DefaultModelSection } from './DefaultModelSection';
import { FactoryModelScopeNotice } from './FactoryModelScopeNotice';
import { ProviderAccessSection } from './ProviderAccessSection';
import { SettingsSubsection } from './SettingsSubsection';

export function PersonalModelsSettings() {
  const { anyConnected, providersKnown } = useProviderConnectionState();
  // Personal defaults run only in user-scope Factories, on the caller's own credentials.
  const modelsQuery = usePersonalAvailableModelsQuery();
  const models = modelsQuery.data ?? [];

  return (
    <div className="flex flex-col gap-8">
      <FactoryModelScopeNotice />
      {(!providersKnown || anyConnected) && (
        <SettingsSubsection
          scope="personal"
          id="default-model"
          title="Your defaults"
          description="The model new chats start on."
        >
          <SettingsContainer>
            <div className="p-4">
              <DefaultModelSection models={models} modelsLoaded={modelsQuery.isSuccess} />
            </div>
          </SettingsContainer>
        </SettingsSubsection>
      )}
      <ProviderAccessSection
        fixedScope="user"
        description="Connect your own provider account for interactive chats. Organization credentials are managed in Factory settings."
      />
    </div>
  );
}
