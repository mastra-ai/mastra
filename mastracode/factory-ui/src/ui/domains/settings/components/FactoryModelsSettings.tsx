import { SettingsContainer } from '@mastra/playground-ui/new/settings';

import type { AvailableModelOption } from '../../../../hooks/useAvailableModels';
import { useProviderConnectionState } from '../hooks/useProviderConnectionState';
import { CustomProvidersSection } from './CustomProvidersSection';
import { FactoryDefaultModelSection } from './FactoryDefaultModelSection';
import { FactoryModelScopeSection } from './FactoryModelScopeSection';
import { SettingsSubsection } from './SettingsSubsection';
import { ProviderAccessSection } from './ProviderAccessSection';

export function FactoryModelsSettings({ models }: { models: AvailableModelOption[] }) {
  const { anyConnected, providersKnown } = useProviderConnectionState();

  const providerSubsections = (
    <>
      <ProviderAccessSection
        fixedScope="org"
        description={
          anyConnected ? undefined : 'Connect a provider to unlock model selection and observational-memory settings.'
        }
      />
      <SettingsSubsection scope="org" title="Custom providers">
        <SettingsContainer className="p-4">
          <CustomProvidersSection />
        </SettingsContainer>
      </SettingsSubsection>
    </>
  );
  const factoryDefaultsSubsection = (
    <SettingsSubsection
      scope="factory"
      title="Factory defaults"
      description="Where this Factory's sessions and work-item runs get their model, credentials, and thinking level."
    >
      <SettingsContainer>
        <FactoryModelScopeSection />
        {(!providersKnown || anyConnected) && <FactoryDefaultModelSection models={models} />}
      </SettingsContainer>
    </SettingsSubsection>
  );

  if (providersKnown && !anyConnected) {
    return (
      <div className="flex flex-col gap-8">
        {factoryDefaultsSubsection}
        {providerSubsections}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {factoryDefaultsSubsection}
      {providerSubsections}
    </div>
  );
}
