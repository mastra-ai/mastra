import type { AgentControllerSessionSettings } from '@mastra/client-js';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@mastra/playground-ui/components/Dialog';
import { Tab, TabContent, TabList, Tabs } from '@mastra/playground-ui/components/Tabs';
import { useTheme } from '@mastra/playground-ui/components/ThemeProvider';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { Brain, GitBranch, Key, Palette, Search, Server, SlidersHorizontal } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useState } from 'react';

import { useToast } from '../../../ui';

import { useChatPermissions } from '../../chat/context/useChatPermissions';
import { useChatSessionContext } from '../../chat/context/useChatSessionContext';
import { useAgentControllerSettings } from '../../../../../shared/hooks/useAgentControllerSettings';
import { useAvailableModelsQuery } from '../../../../../shared/hooks/useAvailableModels';
import { useSetAgentControllerStateMutation } from '../../../../../shared/hooks/useAgentControllerStateMutations';
import { AGENT_CONTROLLER_ID } from '../../chat/services/constants';
import { CustomProvidersSection } from './CustomProvidersSection';
import { FactoryDefaultModelSection } from './FactoryDefaultModelSection';
import { IntakeSection } from './IntakeSection';
import { ModelPacksSection } from './ModelPacksSection';
import { FactorySetupSection } from './FactorySetupSection';
import { SourceControlSection } from './SourceControlSection';
import { OMSection } from './OMSection';
import { ProvidersSection } from './ProvidersSection';
import { BehaviorTab, GeneralTab, ModelTab } from './SettingsPanel.parts';

type Tab = 'general' | 'source-control' | 'model' | 'memory' | 'behavior' | 'providers' | 'custom-providers';

interface SettingsPanelProps {
  onClose: () => void;
}

const TABS: { id: Tab; label: string; icon: LucideIcon }[] = [
  { id: 'general', label: 'General', icon: Palette },
  { id: 'source-control', label: 'Source Control', icon: GitBranch },
  { id: 'model', label: 'Model', icon: Search },
  { id: 'memory', label: 'Memory', icon: Brain },
  { id: 'behavior', label: 'Behavior', icon: SlidersHorizontal },
  { id: 'providers', label: 'API Keys', icon: Key },
  { id: 'custom-providers', label: 'Custom', icon: Server },
];

/**
 * Preferences modal. A two-pane layout (nav rail + one scrollable content pane)
 * keeps long sections — the model catalog and the provider list — reachable
 * without nested scroll fighting. Mirrors the TUI `/settings` surface: theme,
 * density, model, thinking level, auto-approve, notifications, smart editing,
 * and provider/API-key management.
 */
export function SettingsPanel({ onClose }: SettingsPanelProps) {
  const [tab, setTab] = useState<Tab>('general');
  const { theme, setTheme } = useTheme();
  const { resourceId, sessionEnabled, projectPath, baseUrl } = useChatSessionContext();
  const { permissions, pendingPermissionCategory, setPermissionForCategory } = useChatPermissions();
  const { toast } = useToast();
  const hookArgs = {
    agentControllerId: AGENT_CONTROLLER_ID,
    resourceId,
    projectPath,
    baseUrl,
    enabled: sessionEnabled,
  };
  // Session-independent: pickers (Factory default model, packs, OM) need the
  // catalog even before any chat session exists.
  const modelsQuery = useAvailableModelsQuery();
  const settingsQuery = useAgentControllerSettings(hookArgs);
  const setStateMutation = useSetAgentControllerStateMutation(hookArgs);
  const models = modelsQuery.data ?? [];
  const settings = settingsQuery.data ?? null;
  const sessionResourceId = sessionEnabled ? resourceId : undefined;
  // Web chat sessions register under (resourceId, scope=projectPath); the
  // session-scoped config routes need the same pair to find the session.
  const sessionScope = sessionEnabled ? projectPath : undefined;

  const onBehaviorChange = (updates: Partial<AgentControllerSessionSettings>) => {
    void setStateMutation.mutateAsync(updates).then(() => toast('Settings updated', 'success'));
  };

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent className="w-full max-w-4xl h-[80vh] grid-rows-[auto_1fr] items-stretch p-0" aria-label="Settings">
        <DialogHeader className="px-5 pt-4 pb-2">
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>

        <Tabs<Tab> defaultTab="general" value={tab} onValueChange={setTab} className="flex flex-col min-h-0 h-full">
          <TabList className="px-5 shrink-0">
            {TABS.map(({ id, label, icon: Icon }) => (
              <Tab key={id} value={id}>
                <Icon size={15} />
                <span>{label}</span>
              </Tab>
            ))}
          </TabList>

          <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-5">
            <TabContent value="general">
              <GeneralTab theme={theme} onThemeChange={setTheme} />
              <FactorySetupSection />
              <IntakeSection />
            </TabContent>
            <TabContent value="source-control">
              <SourceControlSection />
            </TabContent>
            <TabContent value="model">
              <ModelTab settings={settings} onBehaviorChange={onBehaviorChange} />
              <FactoryDefaultModelSection models={models} />
              <div className="mt-6 flex flex-col gap-2">
                <Txt variant="ui-lg" className="font-medium">
                  Model packs
                </Txt>
                <ModelPacksSection resourceId={sessionResourceId} scope={sessionScope} models={models} />
              </div>
            </TabContent>
            <TabContent value="memory">
              <OMSection resourceId={sessionResourceId} scope={sessionScope} models={models} />
            </TabContent>
            <TabContent value="behavior">
              <BehaviorTab
                settings={settings}
                onBehaviorChange={onBehaviorChange}
                permissions={permissions ?? null}
                pendingPermissionCategory={pendingPermissionCategory}
                setPermissionForCategory={setPermissionForCategory}
              />
            </TabContent>
            <TabContent value="providers">
              <ProvidersSection />
            </TabContent>
            <TabContent value="custom-providers">
              <CustomProvidersSection />
            </TabContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
