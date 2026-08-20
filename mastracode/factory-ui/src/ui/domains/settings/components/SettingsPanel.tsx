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
import { ThinkingDefaultsSection } from './ThinkingDefaultsSection';
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
          <div className="flex flex-col gap-8">
            <Tabs defaultTab={hash === '#model-packs' ? 'user' : 'factory'}>
              <TabList variant="pill">
                <Tab value="factory">Factory</Tab>
                <Tab value="user">User</Tab>
              </TabList>
              <TabContent value="factory" className="flex flex-col gap-8 pt-4">
                <SettingsSubsection
                  title="Defaults"
                  description="Applied to Factory runs (triage, board work items) and channel sessions."
                >
                  <SettingsCard>
                    <FactoryDefaultModelSection models={models} />
                  </SettingsCard>
                </SettingsSubsection>
                <SettingsSubsection
                  title="Observational memory"
                  description="Models and token thresholds Factory runs use to summarize and retain context. Unset values fall back to the built-in defaults."
                >
                  <SettingsCard className="p-4">
                    <OMSection factoryId={factoryId} models={models} />
                  </SettingsCard>
                </SettingsSubsection>
              </TabContent>
              <TabContent value="user" className="flex flex-col gap-8 pt-4">
                <SettingsSubsection title="Session">
                  <SettingsCard>
                    <ModelSettings
                      settings={settings}
                      updating={updateSettingsMutation.isPending}
                      onBehaviorChange={onBehaviorChange}
                    />
                  </SettingsCard>
                </SettingsSubsection>
                <SettingsSubsection
                  id="model-packs"
                  title="Chat model packs"
                  description="Set your personal Build, Plan and Fast defaults for interactive chats. Factory work runs are unaffected."
                >
                  <SettingsCard className="p-4">
                    <ModelPacksSection models={models} />
                  </SettingsCard>
                </SettingsSubsection>
                <SettingsSubsection
                  title="Observational memory"
                  description="Your personal models and token thresholds used to summarize and retain conversation context in interactive chats. Factory runs use the Factory tab's settings."
                >
                  <SettingsCard className="p-4">
                    <OMSection resourceId={sessionResourceId} scope={sessionScope} models={models} />
                  </SettingsCard>
                </SettingsSubsection>
              </TabContent>
            </Tabs>
            <SettingsSubsection
              title="Thinking defaults"
              description="Reasoning-effort applied to runs without a session override — including automated Factory runs. The session thinking level above takes precedence."
            >
              <SettingsCard>
                <ThinkingDefaultsSection />
              </SettingsCard>
            </SettingsSubsection>
            <SettingsSubsection title="Provider access">
              <SettingsCard className="p-4">
                <ProviderAccessSection />
              </SettingsCard>
            </SettingsSubsection>
            <SettingsSubsection title="Custom providers">
              <SettingsCard className="p-4">
                <CustomProvidersSection />
              </SettingsCard>
            </SettingsSubsection>
          </div>
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
