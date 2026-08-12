import type { AgentControllerSessionSettings } from '@mastra/client-js';
import { useTheme } from '@mastra/playground-ui/components/ThemeProvider';
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
import { FactoryAutomationSection } from './FactoryAutomationSection';
import { FactoryManagementSection } from './FactoryManagementSection';
import { FactoryDefaultModelSection } from './FactoryDefaultModelSection';
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
  const { theme, setTheme } = useTheme();
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
        {section === 'factory' && (
          <div className="flex flex-col gap-8">
            <FactoryAutomationSection />
            <FactoryManagementSection />
          </div>
        )}
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
            <SettingsSubsection title="Defaults">
              <SettingsCard>
                <FactoryDefaultModelSection models={models} />
                <ModelSettings
                  settings={settings}
                  updating={updateSettingsMutation.isPending}
                  onBehaviorChange={onBehaviorChange}
                />
              </SettingsCard>
            </SettingsSubsection>
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
            <SettingsSubsection
              title="Model packs"
              description="A pack sets a model for each mode (build / plan / fast)."
            >
              <SettingsCard className="p-4">
                <ModelPacksSection resourceId={sessionResourceId} scope={sessionScope} models={models} />
              </SettingsCard>
            </SettingsSubsection>
            <SettingsSubsection
              title="Observational memory"
              description="Choose the models and token thresholds used to summarize and retain conversation context."
            >
              <SettingsCard className="p-4">
                <OMSection resourceId={sessionResourceId} scope={sessionScope} models={models} />
              </SettingsCard>
            </SettingsSubsection>
          </div>
        )}
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
