import type { AgentControllerSessionSettings } from '@mastra/client-js';
import { useEffect } from 'react';
import { Navigate, useLocation, useParams } from 'react-router';
import { toast } from '@mastra/playground-ui/components/Toaster';

import { useServerFeatures } from '../../../../hooks/useServerFeatures';
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
import { KnowledgeSection } from './KnowledgeSection';
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
  const { resourceId, resourceEnabled, projectPath, baseUrl } = useChatSessionContext();
  const { permissions, setPermissionForCategory } = useChatPermissions();
  const sessionScope = resourceEnabled && projectPath ? projectPath : undefined;
  const hookArgs = {
    agentControllerId: AGENT_CONTROLLER_ID,
    resourceId,
    scope: sessionScope,
    baseUrl,
    enabled: resourceEnabled,
  };

  const modelsQuery = useAvailableModelsQuery();
  const settingsQuery = useAgentControllerSettings(hookArgs);
  const updateSettingsMutation = useUpdateAgentControllerSettingsMutation(hookArgs);
  const models = modelsQuery.data ?? [];
  const settings = settingsQuery.data ?? null;
  const sessionResourceId = resourceEnabled ? resourceId : undefined;

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
        <SettingsSubsection
          scope="personal"
          title="Connected accounts"
          description="Connect your account to use Factory from Slack."
        >
          <ConnectedAccountsSection />
        </SettingsSubsection>
      )}
      {section === 'repositories' && <RepositoriesSection />}
      {section === 'environment' && <EnvironmentSection />}
      {section === 'intake' && <IntakeSection />}
      {section === 'knowledge' && <KnowledgeSettingsRoute factoryId={factoryId} />}
      {section === 'models' && (
        <FactoryModelsSettings models={models} settings={settings} onBehaviorChange={onBehaviorChange} />
      )}
      {section === 'personal-models' && <PersonalModelsSettings models={models} />}
      {(section === 'memory' || section === 'factory-memory') && (
        <MemorySettings
          key={section}
          scope={section === 'factory-memory' ? 'factory' : 'personal'}
          factoryId={factoryId}
          models={models}
          sessionResourceId={sessionResourceId}
          sessionScope={sessionScope}
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

/**
 * Renders the Knowledge settings page, or bounces to Preferences (the
 * always-available Sources landing) when the server doesn't advertise the
 * knowledge feature. The nav item is hidden in that case too, so this
 * redirect only fires for deep-linked URLs or bookmarked routes after a
 * deploy flipped the flag off.
 */
function KnowledgeSettingsRoute({ factoryId }: { factoryId: string | undefined }) {
  const features = useServerFeatures();
  if (features.isPending || !factoryId) return null;
  if (!features.data?.knowledge) {
    return <Navigate to={settingsSectionPath(factoryId, 'preferences')} replace />;
  }
  return <KnowledgeSection />;
}
