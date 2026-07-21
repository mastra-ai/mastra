import type { AgentControllerSessionSettings } from '@mastra/client-js';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@mastra/playground-ui/components/Dialog';
import { ScrollArea } from '@mastra/playground-ui/components/ScrollArea';
import { Tab, TabContent, TabList, Tabs } from '@mastra/playground-ui/components/Tabs';
import { useTheme } from '@mastra/playground-ui/components/ThemeProvider';
import { Brain, FolderKanban, Key, Layers, Palette, Search, Server, SlidersHorizontal } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useState } from 'react';

import { useToast } from '../../../ui/toast';

import { useChatPermissions } from '../../chat/context/useChatPermissions';
import { useChatSessionContext } from '../../chat/context/useChatSessionContext';
import { useAgentControllerModels } from '../../../../../shared/hooks/useAgentControllerModels';
import { useAgentControllerSettings } from '../../../../../shared/hooks/useAgentControllerSettings';
import { useSetAgentControllerStateMutation } from '../../../../../shared/hooks/useAgentControllerStateMutations';
import { AGENT_CONTROLLER_ID } from '../../chat/services/constants';
import { CustomProvidersSection } from './CustomProvidersSection';
import { IntakeSection } from './IntakeSection';
import { ModelPacksSection } from './ModelPacksSection';
import { FactorySetupSection } from './FactorySetupSection';
import { FactoriesSection } from './FactoriesSection';
import { OMSection } from './OMSection';
import { ProvidersSection } from './ProvidersSection';
import { BehaviorTab, GeneralTab, ModelTab } from './SettingsPanel.parts';

type Tab = 'general' | 'factories' | 'model' | 'packs' | 'memory' | 'behavior' | 'providers' | 'custom-providers';

interface SettingsPanelProps {
  onClose: () => void;
}

const TABS: { id: Tab; label: string; icon: LucideIcon }[] = [
  { id: 'general', label: 'General', icon: Palette },
  { id: 'factories', label: 'Factories', icon: FolderKanban },
  { id: 'model', label: 'Model', icon: Search },
  { id: 'packs', label: 'Packs', icon: Layers },
  { id: 'memory', label: 'Memory', icon: Brain },
  { id: 'behavior', label: 'Behavior', icon: SlidersHorizontal },
  { id: 'providers', label: 'API Keys', icon: Key },
  { id: 'custom-providers', label: 'Custom', icon: Server },
];

/**
 * Preferences modal. A two-pane layout keeps each settings section reachable
 * in one scrolling content pane; dense provider results use a bounded,
 * virtualized list within that pane.
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
  const modelsQuery = useAgentControllerModels(hookArgs);
  const settingsQuery = useAgentControllerSettings(hookArgs);
  const setStateMutation = useSetAgentControllerStateMutation(hookArgs);
  const models = modelsQuery.data ?? [];
  const settings = settingsQuery.data ?? null;
  const sessionResourceId = sessionEnabled ? resourceId : undefined;

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

          <ScrollArea className="min-h-0 flex-1" viewPortClassName="px-5 pb-5">
            <TabContent value="general">
              <GeneralTab theme={theme} onThemeChange={setTheme} />
              <FactorySetupSection />
              <IntakeSection />
            </TabContent>
            <TabContent value="factories">
              <FactoriesSection />
            </TabContent>
            <TabContent value="model">
              <ModelTab settings={settings} onBehaviorChange={onBehaviorChange} />
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
          </ScrollArea>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
