import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@mastra/playground-ui/components/Dialog';
import { Tab, TabContent, TabList, Tabs } from '@mastra/playground-ui/components/Tabs';
import { useTheme } from '@mastra/playground-ui/components/ThemeProvider';
import { Brain, Key, Layers, Palette, Search, Server, SlidersHorizontal } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useState } from 'react';

import { useApiConfig } from '../../../../../shared/api/config';
import { useOverlays } from '../../../lib/overlays';
import { useToast } from '../../../ui';
import { useActiveProjectContext } from '../../workspaces';
import { useChatSession } from '../../chat/context/ChatSessionProvider';
import { useAgentControllerModels } from '../../chat/hooks/useAgentControllerModels';
import { useSetPermissionForCategoryMutation } from '../../chat/hooks/useAgentControllerPermissionMutations';
import { useAgentControllerPermissions } from '../../chat/hooks/useAgentControllerPermissions';
import { useAgentControllerSettings } from '../../chat/hooks/useAgentControllerSettings';
import {
  useSetAgentControllerStateMutation,
  useSwitchAgentControllerModelMutation,
} from '../../chat/hooks/useAgentControllerStateMutations';
import { AGENT_CONTROLLER_ID } from '../../chat/services/constants';
import { CustomProvidersSection } from './CustomProvidersSection';
import { ModelPacksSection } from './ModelPacksSection';
import { OMSection } from './OMSection';
import { ProvidersSection } from './ProvidersSection';
import { BehaviorTab, GeneralTab, ModelTab } from './SettingsPanel.parts';

type Tab = 'general' | 'model' | 'packs' | 'memory' | 'behavior' | 'providers' | 'custom-providers';

const TABS: { id: Tab; label: string; icon: LucideIcon }[] = [
  { id: 'general', label: 'General', icon: Palette },
  { id: 'model', label: 'Model', icon: Search },
  { id: 'packs', label: 'Packs', icon: Layers },
  { id: 'memory', label: 'Memory', icon: Brain },
  { id: 'behavior', label: 'Behavior', icon: SlidersHorizontal },
  { id: 'providers', label: 'API Keys', icon: Key },
  { id: 'custom-providers', label: 'Custom', icon: Server },
];

/** Preferences modal backed by the existing chat, workspace, theme, and overlay providers. */
export function SettingsPanel() {
  const [tab, setTab] = useState<Tab>('general');
  const { baseUrl } = useApiConfig();
  const { close } = useOverlays();
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();
  const { resourceId, sessionEnabled } = useActiveProjectContext();
  const { transcript } = useChatSession();
  const hookArgs = { agentControllerId: AGENT_CONTROLLER_ID, resourceId, baseUrl, enabled: sessionEnabled };
  const modelsQuery = useAgentControllerModels(hookArgs);
  const settingsQuery = useAgentControllerSettings(hookArgs);
  const permissionsQuery = useAgentControllerPermissions(hookArgs);
  const switchModelMutation = useSwitchAgentControllerModelMutation(hookArgs);
  const setStateMutation = useSetAgentControllerStateMutation(hookArgs);
  const setPermissionForCategoryMutation = useSetPermissionForCategoryMutation(hookArgs);

  return (
    <Dialog open onOpenChange={open => !open && close('settings')}>
      <DialogContent className="w-full max-w-4xl h-[80vh] grid-rows-[auto_1fr] items-stretch p-0" aria-label="Settings">
        <DialogHeader className="px-5 pt-4 pb-2"><DialogTitle>Settings</DialogTitle></DialogHeader>
        <Tabs<Tab> defaultTab="general" value={tab} onValueChange={setTab} className="flex flex-col min-h-0 h-full">
          <TabList className="px-5 shrink-0">
            {TABS.map(({ id, label, icon: Icon }) => <Tab key={id} value={id}><Icon size={15} /><span>{label}</span></Tab>)}
          </TabList>
          <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-5">
            <TabContent value="general"><GeneralTab theme={theme} onThemeChange={setTheme} /></TabContent>
            <TabContent value="model">
              <ModelTab
                models={modelsQuery.data ?? []}
                currentModelId={transcript.modelId ?? null}
                settings={settingsQuery.data ?? null}
                onModelChange={modelId => void switchModelMutation.mutateAsync(modelId).then(() => toast('Model updated', 'success'))}
                onBehaviorChange={updates => void setStateMutation.mutateAsync(updates).then(() => toast('Settings updated', 'success'))}
              />
            </TabContent>
            <TabContent value="packs"><ModelPacksSection resourceId={sessionEnabled ? resourceId : undefined} models={modelsQuery.data ?? []} /></TabContent>
            <TabContent value="memory"><OMSection resourceId={sessionEnabled ? resourceId : undefined} models={modelsQuery.data ?? []} /></TabContent>
            <TabContent value="behavior">
              <BehaviorTab
                settings={settingsQuery.data ?? null}
                onBehaviorChange={updates => void setStateMutation.mutateAsync(updates).then(() => toast('Settings updated', 'success'))}
                permissions={permissionsQuery.data ?? null}
                pendingPermissionCategory={setPermissionForCategoryMutation.variables?.category ?? null}
                setPermissionForCategory={(category, policy) => setPermissionForCategoryMutation.mutateAsync({ category, policy })}
              />
            </TabContent>
            <TabContent value="providers"><ProvidersSection /></TabContent>
            <TabContent value="custom-providers"><CustomProvidersSection /></TabContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
