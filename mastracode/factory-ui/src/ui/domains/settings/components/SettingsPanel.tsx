import type { AgentControllerSessionSettings } from '@mastra/client-js';
import { useTheme } from '@mastra/playground-ui/components/ThemeProvider';
import { useEffect } from 'react';
import { Link, useLocation, useParams } from 'react-router';
import { Brain } from 'lucide-react';
import { buttonVariants } from '@mastra/playground-ui/components/Button';
import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { useMainSidebar } from '@mastra/playground-ui/components/MainSidebar';
import { toast } from '@mastra/playground-ui/components/Toaster';

import { useChatPermissions } from '../../chat/context/useChatPermissions';
import { useChatSessionContext } from '../../chat/context/useChatSessionContext';
import { useSettingsSection } from '../hooks/useSettingsSection';
import { settingsSectionPath } from '../settingsSections';
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
    <section aria-label="Settings" className="flex flex-1 flex-col lg:px-5 lg:pb-5">
      <div className="mx-auto grid w-full max-w-4xl grid-cols-[minmax(0,1fr)] py-3">
        {!isMobile && <SettingsHeader autoFocus placement="desktop" />}
        {section === 'account' && <AccountSettingsSection />}
        {section === 'preferences' && <GeneralSettings theme={theme} onThemeChange={setTheme} />}
        {section === 'factory' && <FactoryManagementSection />}
        {section === 'connections' && (
          <SettingsSubsection title="Connected accounts" description="Connect your account to use Factory from Slack.">
            <ConnectedAccountsSection />
          </SettingsSubsection>
        )}
        {section === 'repositories' && <RepositoriesSection />}
        {section === 'intake' && <IntakeSection />}
        {section === 'models' && (
          <ModelsSettingsSection
            models={models}
            settings={settings}
            updating={updateSettingsMutation.isPending}
            onBehaviorChange={onBehaviorChange}
          />
        )}
        {section === 'memory' && (
          <MemorySettingsSection
            factoryId={factoryId}
            models={models}
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
  models: AvailableModelOption[];
  settings: AgentControllerSessionSettings | null;
  updating: boolean;
  onBehaviorChange: (updates: Partial<AgentControllerSessionSettings>) => void;
}

interface MemorySettingsSectionProps {
  factoryId: string | undefined;
  models: AvailableModelOption[];
  sessionResourceId: string | undefined;
  sessionScope: string | undefined;
}

/**
 * Observational-memory settings, split by scope. OM models are useless
 * without a provider credential, so until one is connected the page is a
 * zero state pointing at the Models page.
 */
function MemorySettingsSection({ factoryId, models, sessionResourceId, sessionScope }: MemorySettingsSectionProps) {
  const providersQuery = useProvidersQuery();
  const customProvidersQuery = useCustomProvidersQuery();
  const anyConnected =
    (providersQuery.data ?? []).some(p => p.source !== 'none') || (customProvidersQuery.data ?? []).length > 0;
  const providersKnown = providersQuery.isSuccess && customProvidersQuery.isSuccess;

  if (providersKnown && !anyConnected) {
    return (
      <EmptyState
        as="h2"
        iconSlot={<Brain size={40} className="text-icon3" />}
        titleSlot="No models configured"
        descriptionSlot="Observational memory needs a model to summarize and retain context. Connect a provider on the Models page first."
        actionSlot={
          factoryId ? (
            <Link to={settingsSectionPath(factoryId, 'models')} className={buttonVariants({ variant: 'primary' })}>
              Open Models settings
            </Link>
          ) : undefined
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Without a factory id an unscoped OM request would resolve — and let
          this section edit — the caller's personal row as if it were shared. */}
      {factoryId && (
        <SettingsSubsection
          title="Factory observational memory"
          description="Models and token thresholds used to summarize and retain context in Factory runs."
        >
          <SettingsCard>
            <OMSection factoryId={factoryId} models={models} />
          </SettingsCard>
        </SettingsSubsection>
      )}
      <SettingsSubsection
        title="Your observational memory"
        description="Models and token thresholds used to summarize and retain context in your interactive chats."
      >
        <SettingsCard>
          <OMSection resourceId={sessionResourceId} scope={sessionScope} models={models} />
        </SettingsCard>
      </SettingsSubsection>
    </div>
  );
}

/**
 * Layered setup: until at least one provider credential is usable, model and
 * OM pickers are pointless, so the page leads with the connect step alone.
 * Once connected, model selection moves to the top and provider management
 * drops to the bottom.
 */
function ModelsSettingsSection({ models, settings, updating, onBehaviorChange }: ModelsSettingsSectionProps) {
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
        <ProviderAccessSection />
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
        title="Factory defaults"
        description="Applied to Factory runs (triage, board work items) and channel sessions."
      >
        <SettingsCard>
          <FactoryDefaultModelSection models={models} />
          <BaseThinkingSection />
        </SettingsCard>
      </SettingsSubsection>
      <SettingsSubsection id="model-packs" title="Your defaults" description="Applied to your interactive chats.">
        <SettingsCard>
          <div className="p-4">
            <ModelPacksSection models={models} />
          </div>
          <ModelSettings settings={settings} updating={updating} onBehaviorChange={onBehaviorChange} />
          <ModeThinkingDefaultsSection />
        </SettingsCard>
      </SettingsSubsection>
      {providerSubsections}
    </div>
  );
}
