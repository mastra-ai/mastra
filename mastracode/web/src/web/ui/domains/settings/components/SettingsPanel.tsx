import type { AgentControllerSessionSettings } from '@mastra/client-js';
import { useTheme } from '@mastra/playground-ui/components/ThemeProvider';
import { useMainSidebar } from '@mastra/playground-ui/components/MainSidebar';
import { toast } from '@mastra/playground-ui/components/Toaster';
import { Txt } from '@mastra/playground-ui/components/Txt';

import { useChatPermissions } from '../../chat/context/useChatPermissions';
import { useChatSessionContext } from '../../chat/context/useChatSessionContext';
import { useSettingsSection } from '../hooks/useSettingsSection';
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
import { ProviderAccessSection } from './ProviderAccessSection';
import { BehaviorSettings, GeneralSettings, ModelSettings } from './SettingsPanel.parts';

/**
 * Shared subsection recipe: header (title + optional description + optional
 * right-side action) above a contained card. Containment replaces hairline
 * separators so uneven content heights still read as intentional.
 */
function SettingsSubsection({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-3">
          <Txt variant="ui-md" className="text-icon6 font-medium">
            {title}
          </Txt>
          {action}
        </div>
        {description && (
          <Txt variant="ui-sm" className="text-icon3">
            {description}
          </Txt>
        )}
      </div>
      <div className="border-border1 rounded-lg border p-4">{children}</div>
    </div>
  );
}

function getSettingsUpdateErrorMessage(error: unknown): string {
  if (error instanceof SettingsUpdateVerificationError) return error.message;
  if (error instanceof Error) return `Failed to update settings: ${error.message}`;
  return 'Failed to update settings';
}

/**
 * Settings content pane: renders the section addressed by the settings-page
 * URL while the page shell supplies document scrolling.
 */
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
        {section === 'general' && (
          <>
            <GeneralSettings theme={theme} onThemeChange={setTheme} />
            <FactorySetupSection />
            <IntakeSection />
          </>
        )}
        {section === 'source-control' && <SourceControlSection />}
        {section === 'model' && (
          <div className="flex flex-col gap-8">
            <SettingsSubsection title="Defaults">
              {/* Rows bring their own py-3; -my-3 keeps the card's effective padding even on all sides. */}
              <div className="divide-border1/40 -my-3 divide-y">
                <FactoryDefaultModelSection models={models} />
                <ModelSettings
                  settings={settings}
                  updating={updateSettingsMutation.isPending}
                  onBehaviorChange={onBehaviorChange}
                />
              </div>
            </SettingsSubsection>
            <SettingsSubsection title="Providers">
              <ProviderAccessSection />
            </SettingsSubsection>
            <SettingsSubsection
              title="Model packs"
              description="A pack sets a model for each mode (build / plan / fast)."
            >
              <ModelPacksSection resourceId={sessionResourceId} scope={sessionScope} models={models} />
            </SettingsSubsection>
            <SettingsSubsection
              title="Observational memory"
              description="Choose the models and token thresholds used to summarize and retain conversation context."
            >
              <OMSection resourceId={sessionResourceId} scope={sessionScope} models={models} />
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
        {section === 'custom-providers' && <CustomProvidersSection />}
      </div>
    </section>
  );
}
