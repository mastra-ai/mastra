import type { AgentControllerSessionSettings } from '@mastra/client-js';
import { SettingsContainer } from '@mastra/playground-ui/new/settings';

import type { AvailableModelOption } from '../../../../hooks/useAvailableModels';
import { useProvidersQuery } from '../../../../hooks/use-providers';
import { useCustomProvidersQuery } from '../../../../hooks/use-custom-providers';
import { CustomProvidersSection } from './CustomProvidersSection';
import { FactoryDefaultModelSection } from './FactoryDefaultModelSection';
import { SettingsSubsection } from './SettingsSubsection';
import { BaseThinkingSection, ModeThinkingDefaultsSection } from './ThinkingDefaultsSection';
import { ProviderAccessSection } from './ProviderAccessSection';
import { ModelSettings } from './SettingsPanel.parts';

interface FactoryModelsSettingsProps {
  models: AvailableModelOption[];
  settings: AgentControllerSessionSettings | null;
  onBehaviorChange: (updates: Partial<AgentControllerSessionSettings>) => Promise<unknown>;
}

export function FactoryModelsSettings({ models, settings, onBehaviorChange }: FactoryModelsSettingsProps) {
  const providersQuery = useProvidersQuery();
  const customProvidersQuery = useCustomProvidersQuery();
  const anyConnected =
    (providersQuery.data ?? []).some(p => p.source !== 'none') || (customProvidersQuery.data ?? []).length > 0;
  const providersKnown = providersQuery.isSuccess && customProvidersQuery.isSuccess;

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

  if (providersKnown && !anyConnected) {
    return <div className="flex flex-col gap-8">{providerSubsections}</div>;
  }

  return (
    <div className="flex flex-col gap-8">
      <SettingsSubsection
        scope="factory"
        title="Factory defaults"
        description="Applied to Factory runs (triage, board work items) and channel sessions."
      >
        <SettingsContainer>
          <FactoryDefaultModelSection models={models} />
        </SettingsContainer>
      </SettingsSubsection>
      <SettingsSubsection
        scope="deployment"
        title="Thinking defaults"
        description="Fallback for every run without its own level. One settings file, shared by every Factory on this server."
      >
        <SettingsContainer>
          <BaseThinkingSection />
          <ModeThinkingDefaultsSection />
        </SettingsContainer>
      </SettingsSubsection>
      <SettingsSubsection
        scope="factory"
        title="Chat defaults"
        description="Applied to chats opened from this Factory, and shared with everyone working in it."
      >
        <SettingsContainer>
          <ModelSettings settings={settings} onBehaviorChange={onBehaviorChange} />
        </SettingsContainer>
      </SettingsSubsection>
      {providerSubsections}
    </div>
  );
}
