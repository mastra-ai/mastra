import type { AgentControllerSessionSettings } from '@mastra/client-js';
import { useTheme } from '@mastra/playground-ui/components/ThemeProvider';
import { useEffect } from 'react';
import { useLocation, useParams } from 'react-router';
import { Tab, TabContent, TabList, Tabs } from '@mastra/playground-ui/components/Tabs';
import { useMainSidebar } from '@mastra/playground-ui/components/MainSidebar';
import { toast } from '@mastra/playground-ui/components/Toaster';
import { Txt } from '@mastra/playground-ui/components/Txt';

import { useChatPermissions } from '../../chat/context/useChatPermissions';
import { useChatSessionContext } from '../../chat/context/useChatSessionContext';
import { useSettingsSection } from '../hooks/useSettingsSection';
import { useAgentControllerSettings } from '../../../../hooks/useAgentControllerSettings';
import { useAvailableModelsQuery } from '../../../../hooks/useAvailableModels';
import type { AvailableModelOption } from '../../../../hooks/useAvailableModels';
import { useProvidersQuery } from '../../../../hooks/use-providers';
import { useCustomProvidersQuery } from '../../../../hooks/use-custom-providers';
import {
  SettingsUpdateVerificationError,
  useUpdateAgentControllerSettingsMutation,
} from '../../../../hooks/useUpdateAgentControllerSettingsMutation';
import { AGENT_CONTROLLER_ID } from '../../chat/services/constants';
import { ConnectedAccountsSection } from './ConnectedAccountsSection';
import { AccountSettingsSection } from './AccountSettingsSection';
import { CustomProvidersSection } from './CustomProvidersSection';
import { SettingsHeader } from './SettingsHeader';
import { FactoryManagementSection } from './FactoryManagementSection';
import { FactoryDefaultModelSection } from './FactoryDefaultModelSection';
import { FactorySkillsSection } from './FactorySkillsSection';
import { IntakeSection } from './IntakeSection';
import { ModelPacksSection } from './ModelPacksSection';
import { RepositoriesSection } from './RepositoriesSection';
import { SettingsCard } from './SettingsCard';
import { SettingsSubsection } from './SettingsSubsection';
import { OMSection } from './OMSection';
import { BaseThinkingSection, ModeThinkingDefaultsSection } from './ThinkingDefaultsSection';
import { ProviderAccessSection } from './ProviderAccessSection';
import { BehaviorSettings, GeneralSettings, ModelSettings } from './SettingsPanel.parts';

function getSettingsUpdateErrorMessage(error: unknown): string {
  if (error instanceof SettingsUpdateVerificationError) return error.message;
  if (error instanceof Error) return `Failed to update settings: ${error.message}`;
  return 'Failed to update settings';
}

export function SettingsPanel() {
  const section = useSettingsSection();
  const { hash } = useLocation();
  const { factoryId } = useParams<{ factoryId: string }>();
  const { theme, setTheme } = useTheme();

  // Deep links like `/settings/models#model-packs` scroll to the subsection.
  useEffect(() => {
    if (!hash) return;
    document.getElementById(hash.slice(1))?.scrollIntoView?.({ block: 'start' });
  }, [hash, section]);
  const { resourceId, resourceEnabled, projectPath, baseUrl } = useChatSessionContext();
  const { isMobile } = useMainSidebar();
  const { permissions, pendingPermissionCategory, setPermissionForCategory } = useChatPermissions();
  const sessionScope = resourceEnabled && projectPath ? projectPath : undefined;
  const hookArgs = {
    agentControllerId: AGENT_CONTROLLER_ID,
    resourceId,
    scope: sessionScope,
    baseUrl,
    enabled: resourceEnabled,
  };
  // Session-independent: pickers (Factory default model, packs) need the
  // catalog even before any chat session exists.
  const modelsQuery = useAvailableModelsQuery();
  const settingsQuery = useAgentControllerSettings(hookArgs);
  const updateSettingsMutation = useUpdateAgentControllerSettingsMutation(hookArgs);
  const models = modelsQuery.data ?? [];
  const settings = settingsQuery.data ?? null;
  const sessionResourceId = resourceEnabled ? resourceId : undefined;

  const onBehaviorChange = (updates: Partial<AgentControllerSessionSettings>) => {
    if (!settings || updateSettingsMutation.isPending) return;
    updateSettingsMutation.mutate(updates, {
      onSuccess: () => toast.success('Settings updated'),
      onError: error => toast.error(getSettingsUpdateErrorMessage(error)),
    });
  };

  return (
    <section aria-label="Settings" className="flex flex-1 flex-col px-5 pb-5">
      <div className="mx-auto grid w-full max-w-4xl py-3">
        {!isMobile && <SettingsHeader autoFocus placement="desktop" />}
        {section === 'account' && <AccountSettingsSection />}
        {section === 'preferences' && <GeneralSettings theme={theme} onThemeChange={setTheme} />}
        {section === 'factory' && <FactoryManagementSection />}
        {section === 'connections' && (
          <div className="flex flex-col gap-2">
            <Txt as="p" variant="ui-sm" className="text-icon3">
              Connect your account to use Factory from Slack.
            </Txt>
            <ConnectedAccountsSection />
          </div>
        )}
        {section === 'repositories' && <RepositoriesSection />}
        {section === 'intake' && <IntakeSection />}
        {section === 'models' && (
          <ModelsSettingsSection
            hash={hash}
            factoryId={factoryId}
            models={models}
            settings={settings}
            updating={updateSettingsMutation.isPending}
            onBehaviorChange={onBehaviorChange}
            sessionResourceId={sessionResourceId}
            sessionScope={sessionScope}
          />
        )}
        {section === 'skills' && <FactorySkillsSection />}
        {section === 'behavior' && (
          <BehaviorSettings
            settings={settings}
            updating={updateSettingsMutation.isPending}
            onBehaviorChange={onBehaviorChange}
            permissions={permissions ?? null}
            pendingPermissionCategory={pendingPermissionCategory}
            setPermissionForCategory={setPermissionForCategory}
          />
        )}
      </div>
    </section>
  );
}

interface ModelsSettingsSectionProps {
  hash: string;
  factoryId: string | undefined;
  models: AvailableModelOption[];
  settings: AgentControllerSessionSettings | null;
  updating: boolean;
  onBehaviorChange: (updates: Partial<AgentControllerSessionSettings>) => void;
  sessionResourceId: string | undefined;
  sessionScope: string | undefined;
}

/**
 * Layered setup: until at least one provider credential is usable, model and
 * OM pickers are pointless, so the page leads with the connect step alone.
 * Once connected, model selection moves to the top and provider management
 * drops to the bottom.
 */
function ModelsSettingsSection({
  hash,
  factoryId,
  models,
  settings,
  updating,
  onBehaviorChange,
  sessionResourceId,
  sessionScope,
}: ModelsSettingsSectionProps) {
  const providersQuery = useProvidersQuery();
  const customProvidersQuery = useCustomProvidersQuery();
  const anyConnected =
    (providersQuery.data ?? []).some(p => p.source !== 'none') || (customProvidersQuery.data ?? []).length > 0;
  const providersKnown = providersQuery.isSuccess && customProvidersQuery.isSuccess;

  const providerSubsections = (
    <>
      <SettingsSubsection
        title="Provider access"
        description={
          anyConnected ? undefined : 'Connect a provider to unlock model selection and observational-memory settings.'
        }
      >
        <SettingsCard className="p-4">
          <ProviderAccessSection />
        </SettingsCard>
      </SettingsSubsection>
      <SettingsSubsection title="Custom providers">
        <SettingsCard className="p-4">
          <CustomProvidersSection />
        </SettingsCard>
      </SettingsSubsection>
    </>
  );

  // Nothing connected yet: show only the connect step.
  if (providersKnown && !anyConnected) {
    return <div className="flex flex-col gap-8">{providerSubsections}</div>;
  }

  return (
    <div className="flex flex-col gap-8">
      <SettingsSubsection
        id="model-packs"
        title="Default models"
        description="Factory defaults apply to Factory runs (triage, board work items) and channel sessions. User defaults apply to your interactive chats."
      >
        <Tabs defaultTab={hash === '#model-packs' ? 'user' : 'factory'}>
          <TabList variant="pill">
            <Tab value="factory">Factory</Tab>
            <Tab value="user">User</Tab>
          </TabList>
          <TabContent value="factory" className="pt-4">
            <SettingsCard>
              <FactoryDefaultModelSection models={models} />
              <BaseThinkingSection />
            </SettingsCard>
          </TabContent>
          <TabContent value="user" className="flex flex-col gap-4 pt-4">
            <SettingsCard className="p-4">
              <ModelPacksSection models={models} />
            </SettingsCard>
            <SettingsCard>
              <ModelSettings settings={settings} updating={updating} onBehaviorChange={onBehaviorChange} />
              <ModeThinkingDefaultsSection />
            </SettingsCard>
          </TabContent>
        </Tabs>
      </SettingsSubsection>
      <SettingsSubsection
        title="Observational memory"
        description="Models and token thresholds used to summarize and retain context. Factory applies to Factory runs; User applies to your interactive chats."
      >
        <Tabs defaultTab="factory">
          <TabList variant="pill">
            <Tab value="factory">Factory</Tab>
            <Tab value="user">User</Tab>
          </TabList>
          <TabContent value="factory" className="pt-4">
            <SettingsCard className="p-4">
              <OMSection factoryId={factoryId} models={models} />
            </SettingsCard>
          </TabContent>
          <TabContent value="user" className="pt-4">
            <SettingsCard className="p-4">
              <OMSection resourceId={sessionResourceId} scope={sessionScope} models={models} />
            </SettingsCard>
          </TabContent>
        </Tabs>
      </SettingsSubsection>
      {providerSubsections}
    </div>
  );
}
