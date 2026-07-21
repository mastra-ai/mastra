import type { AgentControllerSessionSettings } from '@mastra/client-js';
import { useTheme } from '@mastra/playground-ui/components/ThemeProvider';
import { useMainSidebar } from '@mastra/playground-ui/components/MainSidebar';
import { toast } from '@mastra/playground-ui/components/Toaster';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useEffect } from 'react';

import { useKeyDown } from '../../../lib/hooks';

import { useChatPermissions } from '../../chat/context/useChatPermissions';
import { useChatSessionContext } from '../../chat/context/useChatSessionContext';
import { useSettingsSection } from '../context/SettingsNavigationProvider';
import { useCloseSettings } from '../hooks/useCloseSettings';
import { useAgentControllerSettings } from '../../../../../shared/hooks/useAgentControllerSettings';
import { useAvailableModelsQuery } from '../../../../../shared/hooks/useAvailableModels';
import {
  SettingsUpdateVerificationError,
  useUpdateAgentControllerSettingsMutation,
} from '../../../../../shared/hooks/useUpdateAgentControllerSettingsMutation';
import { AGENT_CONTROLLER_ID } from '../../chat/services/constants';
import { CustomProvidersSection } from './CustomProvidersSection';
import { SettingsHeader } from './SettingsHeader';
import { FactoryDefaultModelSection } from './FactoryDefaultModelSection';
import { IntakeSection } from './IntakeSection';
import { ModelPacksSection } from './ModelPacksSection';
import { FactorySetupSection } from './FactorySetupSection';
import { SourceControlSection } from './SourceControlSection';
import { OMSection } from './OMSection';
import { ProvidersSection } from './ProvidersSection';
import { BehaviorSettings, GeneralSettings, ModelSettings } from './SettingsPanel.parts';

function getSettingsUpdateErrorMessage(error: unknown): string {
  if (error instanceof SettingsUpdateVerificationError) return error.message;
  if (error instanceof Error) return `Failed to update settings: ${error.message}`;
  return 'Failed to update settings';
}

/**
 * In-layout settings surface controlled by the application sidebar, with an
 * independently scrolling content pane.
 */
export function SettingsPanel() {
  const section = useSettingsSection();
  const closeSettings = useCloseSettings();
  const { theme, setTheme } = useTheme();
  const { resourceId, sessionEnabled, projectPath, baseUrl } = useChatSessionContext();
  const { isMobile } = useMainSidebar();
  const { permissions, pendingPermissionCategory, setPermissionForCategory } = useChatPermissions();
  const hookArgs = {
    agentControllerId: AGENT_CONTROLLER_ID,
    resourceId,
    scope: projectPath,
    baseUrl,
    enabled: sessionEnabled,
  };
  // Session-independent: pickers (Factory default model, packs, OM) need the
  // catalog even before any chat session exists.
  const modelsQuery = useAvailableModelsQuery();
  const settingsQuery = useAgentControllerSettings(hookArgs);
  const updateSettingsMutation = useUpdateAgentControllerSettingsMutation(hookArgs);
  const models = modelsQuery.data ?? [];
  const settings = settingsQuery.data ?? null;
  const sessionResourceId = sessionEnabled ? resourceId : undefined;
  // Web chat sessions register under (resourceId, scope=projectPath); the
  // session-scoped config routes need the same pair to find the session.
  const sessionScope = sessionEnabled ? projectPath : undefined;

  useEffect(() => {
    document.getElementById(isMobile ? 'settings-title-mobile' : 'settings-title')?.focus();
  }, [isMobile]);

  useKeyDown({ escape: closeSettings });

  const onBehaviorChange = (updates: Partial<AgentControllerSessionSettings>) => {
    if (!settings || updateSettingsMutation.isPending) return;
    updateSettingsMutation.mutate(updates, {
      onSuccess: () => toast.success('Settings updated'),
      onError: error => toast.error(getSettingsUpdateErrorMessage(error)),
    });
  };

  return (
    <section aria-label="Settings" className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">
        <div className="mx-auto grid w-full max-w-4xl py-3">
          <SettingsHeader titleId="settings-title" placement="desktop" />
          {section === 'general' && (
            <>
              <GeneralSettings theme={theme} onThemeChange={setTheme} />
              <FactorySetupSection />
              <IntakeSection />
            </>
          )}
          {section === 'source-control' && <SourceControlSection />}
          {section === 'model' && (
            <>
              <ModelSettings
                settings={settings}
                updating={updateSettingsMutation.isPending}
                onBehaviorChange={onBehaviorChange}
              />
              <FactoryDefaultModelSection models={models} />
              <div className="mt-6 flex flex-col gap-2">
                <Txt variant="ui-lg" className="font-medium">
                  Model packs
                </Txt>
                <ModelPacksSection resourceId={sessionResourceId} scope={sessionScope} models={models} />
              </div>
            </>
          )}
          {section === 'memory' && <OMSection resourceId={sessionResourceId} scope={sessionScope} models={models} />}
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
          {section === 'providers' && <ProvidersSection />}
          {section === 'custom-providers' && <CustomProvidersSection />}
        </div>
      </div>
    </section>
  );
}
