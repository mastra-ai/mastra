import { SettingsContainer } from '@mastra/playground-ui/new/settings';

import type { AvailableModelOption } from '../../../../hooks/useAvailableModels';
import { useProvidersQuery } from '../../../../hooks/use-providers';
import { useCustomProvidersQuery } from '../../../../hooks/use-custom-providers';
import { ModelPacksSection } from './ModelPacksSection';
import { ProviderAccessSection } from './ProviderAccessSection';
import { SettingsSubsection } from './SettingsSubsection';

export function PersonalModelsSettings({ models }: { models: AvailableModelOption[] }) {
  const providersQuery = useProvidersQuery();
  const customProvidersQuery = useCustomProvidersQuery();
  const anyConnected =
    (providersQuery.data ?? []).some(p => p.source !== 'none') || (customProvidersQuery.data ?? []).length > 0;
  const providersKnown = providersQuery.isSuccess && customProvidersQuery.isSuccess;

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
