import type { AgentControllerSessionSettings } from '@mastra/client-js';
import { useEffect } from 'react';
import { useLocation, useParams } from 'react-router';
import { toast } from '@mastra/playground-ui/components/Toaster';

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
import { EnvironmentSection } from './EnvironmentSection';
import { AccountSettingsSection } from './AccountSettingsSection';
import { FactoryManagementSection } from './FactoryManagementSection';
import { FactorySkillsSection } from './FactorySkillsSection';
import { IntakeSection } from './IntakeSection';
import { McpClientsSection } from './McpClientsSection';
import { RepositoriesSection } from './RepositoriesSection';
import { SettingsSubsection } from './SettingsSubsection';
import { BehaviorSettings, GeneralSettings } from './SettingsPanel.parts';
import { FactoryModelsSettings } from './FactoryModelsSettings';
import { PersonalModelsSettings } from './PersonalModelsSettings';
import { MemorySettings } from './MemorySettings';

function getSettingsUpdateErrorMessage(error: unknown): string {
  if (error instanceof SettingsUpdateVerificationError) return error.message;
  if (error instanceof Error) return `Failed to update settings: ${error.message}`;
  return 'Failed to update settings';
}

export function SettingsPanel() {
  const section = useSettingsSection();
  const { hash } = useLocation();
  const { factoryId } = useParams<{ factoryId: string }>();

  useEffect(() => {
    if (!hash) return;
    document.getElementById(hash.slice(1))?.scrollIntoView?.({ block: 'start' });
  }, [hash, section]);
  const { sessionId: chatSessionId, resourceEnabled, baseUrl } = useChatSessionContext();
  const { permissions, setPermissionForCategory } = useChatPermissions();
  const hookArgs = {
    agentControllerId: AGENT_CONTROLLER_ID,
    sessionId: chatSessionId,
    baseUrl,
    enabled: resourceEnabled,
  };

  // Factory-level pickers only offer what the Factory's model scope can run;
  // personal pickers keep the caller's full catalog.
  const factoryScoped = section === 'models' || section === 'factory-memory';
  const modelsQuery = useAvailableModelsQuery(factoryScoped ? { factoryProjectId: factoryId } : undefined);
  const settingsQuery = useAgentControllerSettings(hookArgs);
  const updateSettingsMutation = useUpdateAgentControllerSettingsMutation(hookArgs);
  const models = modelsQuery.data ?? [];
  const settings = settingsQuery.data ?? null;
  const sessionId = resourceEnabled ? chatSessionId : undefined;

  const onBehaviorChange = (updates: Partial<AgentControllerSessionSettings>) => {
    if (!settings) return Promise.resolve();

    return updateSettingsMutation
      .mutateAsync(updates)
      .catch(error => toast.error(getSettingsUpdateErrorMessage(error)));
  };

  return (
    <section aria-label="Settings" className="mt-6 grid grid-cols-[minmax(0,1fr)] pb-5">
      {section === 'account' && <AccountSettingsSection />}
      {section === 'preferences' && <GeneralSettings />}
      {section === 'factory' && <FactoryManagementSection />}
      {section === 'connections' && (
        <div className="flex flex-col gap-8">
          <SettingsSubsection
            scope="personal"
            title="Connected accounts"
            description="Connect your account to use Factory from Slack."
          >
            <ConnectedAccountsSection />
          </SettingsSubsection>
          <McpClientsSection />
        </div>
      )}
      {section === 'repositories' && <RepositoriesSection />}
      {section === 'environment' && <EnvironmentSection />}
      {section === 'intake' && <IntakeSection />}
      {section === 'models' && <FactoryModelsSettings models={models} />}
      {section === 'personal-models' && <PersonalModelsSettings />}
      {(section === 'memory' || section === 'factory-memory') && (
        <MemorySettings
          key={section}
          scope={section === 'factory-memory' ? 'factory' : 'personal'}
          factoryId={factoryId}
          models={models}
          sessionId={sessionId}
        />
      )}
      {section === 'skills' && <FactorySkillsSection factoryId={factoryId} />}
      {section === 'behavior' && (
        <BehaviorSettings
          settings={settings}
          onBehaviorChange={onBehaviorChange}
          permissions={permissions ?? null}
          setPermissionForCategory={setPermissionForCategory}
        />
      )}
    </section>
  );
}
