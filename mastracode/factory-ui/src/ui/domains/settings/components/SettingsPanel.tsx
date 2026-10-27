import type { AgentControllerSessionSettings } from '@mastra/client-js';
import { useParams } from 'react-router';
import { toast } from '@mastra/playground-ui/components/Toaster';

import { useChatPermissions } from '../../chat/context/useChatPermissions';
import { useChatSessionContext } from '../../chat/context/useChatSessionContext';
import { useSettingsSection } from '../hooks/useSettingsSection';
import { useAgentControllerSettings } from '../../../../hooks/useAgentControllerSettings';
import {
  SettingsUpdateVerificationError,
  useUpdateAgentControllerSettingsMutation,
} from '../../../../hooks/useUpdateAgentControllerSettingsMutation';
import { AGENT_CONTROLLER_ID } from '../../chat/services/constants';
import { ConnectionsSection } from './ConnectionsSection';
import { AccountSettingsSection } from './AccountSettingsSection';
import { FactoryManagementSection } from './FactoryManagementSection';
import { FactorySkillsSection } from './FactorySkillsSection';
import { IntakeSection } from './IntakeSection';
import { RepositoriesSection } from './RepositoriesSection';
import { BehaviorSettings, GeneralSettings } from './SettingsPanel.parts';
import { MemorySettings } from './MemorySettings';
import { ModelsSettings } from './models/ModelsSettings';

function getSettingsUpdateErrorMessage(error: unknown): string {
  if (error instanceof SettingsUpdateVerificationError) return error.message;
  if (error instanceof Error) return `Failed to update settings: ${error.message}`;
  return 'Failed to update settings';
}

export function SettingsPanel() {
  const section = useSettingsSection();
  const { factoryId } = useParams<{ factoryId: string }>();
  const { sessionId: chatSessionId, resourceEnabled, baseUrl } = useChatSessionContext();
  const { permissions, setPermissionForCategory } = useChatPermissions();
  const hookArgs = {
    agentControllerId: AGENT_CONTROLLER_ID,
    sessionId: chatSessionId,
    baseUrl,
    enabled: resourceEnabled,
  };

  const settingsQuery = useAgentControllerSettings(hookArgs);
  const updateSettingsMutation = useUpdateAgentControllerSettingsMutation(hookArgs);
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
      {section === 'connections' && <ConnectionsSection />}
      {section === 'repositories' && <RepositoriesSection />}
      {section === 'intake' && <IntakeSection />}
      {section === 'models' && factoryId && <ModelsSettings factoryId={factoryId} />}
      {section === 'memory' && factoryId && <MemorySettings factoryId={factoryId} sessionId={sessionId} />}
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
