import type { AgentControllerSessionSettings } from '@mastra/client-js';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@mastra/playground-ui/components/Dialog';
import { Tab, TabContent, TabList, Tabs } from '@mastra/playground-ui/components/Tabs';
import { useTheme } from '@mastra/playground-ui/components/ThemeProvider';
import { Brain, Layers, LogIn, Palette, Search, Server, SlidersHorizontal } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useState } from 'react';

import { getErrorMessage } from '../../../../../shared/api/errors';
import { useToast } from '../../../ui/toast';
import { useChatModels } from '../../chat/context/useChatModels';
import { useChatPermissions } from '../../chat/context/useChatPermissions';
import { useChatSessionContext } from '../../chat/context/useChatSessionContext';
import { useAgentControllerModels } from '../../chat/hooks/useAgentControllerModels';
import { useAgentControllerSettings } from '../../chat/hooks/useAgentControllerSettings';
import { useSetAgentControllerStateMutation } from '../../chat/hooks/useAgentControllerStateMutations';
import { AGENT_CONTROLLER_ID } from '../../chat/services/constants';
import { CustomProvidersSection } from './CustomProvidersSection';
import { IntakeSection } from './IntakeSection';
import { ModelPacksSection } from './ModelPacksSection';
import { OMSection } from './OMSection';
import { ProvidersSection } from './ProvidersSection';
import { BehaviorTab, GeneralTab, ModelTab } from './SettingsPanel.parts';

export type SettingsTab = 'general' | 'model' | 'packs' | 'memory' | 'behavior' | 'providers' | 'custom-providers';

interface SettingsPanelProps {
  initialTab?: SettingsTab;
  onClose: () => void;
}

const TABS: { id: SettingsTab; label: string; icon: LucideIcon }[] = [
  { id: 'general', label: 'General', icon: Palette },
  { id: 'model', label: 'Model', icon: Search },
  { id: 'packs', label: 'Packs', icon: Layers },
  { id: 'memory', label: 'Memory', icon: Brain },
  { id: 'behavior', label: 'Behavior', icon: SlidersHorizontal },
  { id: 'providers', label: 'Providers', icon: LogIn },
  { id: 'custom-providers', label: 'Custom', icon: Server },
];

/**
 * Preferences modal. A two-pane layout (nav rail + one scrollable content pane)
 * keeps long sections — the model catalog and the provider list — reachable
 * without nested scroll fighting. Mirrors the TUI `/settings` surface: theme,
 * density, model, thinking level, auto-approve, notifications, smart editing,
 * and provider/API-key management.
 */
export function SettingsPanel({ initialTab = 'general', onClose }: SettingsPanelProps) {
  const [tab, setTab] = useState<SettingsTab>(initialTab);
  const { theme, setTheme } = useTheme();
  const { resourceId, sessionEnabled, baseUrl } = useChatSessionContext();
  const { activeModelId, setModel } = useChatModels();
  const { permissions, pendingPermissionCategory, setPermissionForCategory } = useChatPermissions();
  const { toast } = useToast();
  const hookArgs = { agentControllerId: AGENT_CONTROLLER_ID, resourceId, baseUrl, enabled: sessionEnabled };
  const modelsQuery = useAgentControllerModels(hookArgs);
  const settingsQuery = useAgentControllerSettings(hookArgs);
  const setStateMutation = useSetAgentControllerStateMutation(hookArgs);
  const models = modelsQuery.data ?? [];
  const settings = settingsQuery.data ?? undefined;
  const sessionResourceId = sessionEnabled ? resourceId : undefined;

  const onModelChange = (modelId: string) => {
    void setModel(modelId)
      .then(() => toast('Model updated', 'success'))
      .catch(error => toast(getErrorMessage(error, 'The model could not be updated'), 'error'));
  };
  const onBehaviorChange = (updates: Partial<AgentControllerSessionSettings>) => {
    void setStateMutation.mutateAsync(updates).then(() => toast('Settings updated', 'success'));
  };

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent className="w-full max-w-4xl h-[80vh] grid-rows-[auto_1fr] items-stretch p-0" aria-label="Settings">
        <DialogHeader className="px-5 pt-4 pb-2">
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>

        <Tabs<SettingsTab>
          defaultTab={initialTab}
          value={tab}
          onValueChange={setTab}
          className="flex flex-col min-h-0 h-full"
        >
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
              <IntakeSection />
            </TabContent>
            <TabContent value="model">
              <ModelTab
                models={models}
                currentModelId={activeModelId}
                error={
                  modelsQuery.error
                    ? getErrorMessage(modelsQuery.error, 'The model catalog could not be loaded')
                    : undefined
                }
                settings={settings}
                onModelChange={onModelChange}
                onBehaviorChange={onBehaviorChange}
              />
            </TabContent>
            <TabContent value="packs">
              <ModelPacksSection resourceId={sessionResourceId} models={models} />
            </TabContent>
            <TabContent value="memory">
              <OMSection resourceId={sessionResourceId} models={models} />
            </TabContent>
            <TabContent value="behavior">
              <BehaviorTab
                settings={settings}
                onBehaviorChange={onBehaviorChange}
                permissions={permissions ?? undefined}
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
