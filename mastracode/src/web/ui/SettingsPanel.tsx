import type {
  AgentControllerAvailableModel,
  AgentControllerSessionSettings,
  PermissionPolicy,
  PermissionRules,
  ToolCategory,
} from '@mastra/client-js';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Tab,
  TabContent,
  TabList,
  Tabs,
} from '@mastra/playground-ui';
import type { Theme } from '@mastra/playground-ui';
import { Brain, Key, Layers, Palette, Search, Server, SlidersHorizontal } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useState } from 'react';

import { CustomProvidersSection } from './CustomProvidersSection';
import { ModelPacksSection } from './ModelPacksSection';
import { OMSection } from './OMSection';
import { ProvidersSection } from './ProvidersSection';
import { BehaviorTab, GeneralTab, ModelTab } from './SettingsPanel.parts';
import type { Density } from './theme';

type Tab = 'general' | 'model' | 'packs' | 'memory' | 'behavior' | 'providers' | 'custom-providers';

interface SettingsPanelProps {
  theme: Theme;
  density: Density;
  models: AgentControllerAvailableModel[];
  currentModelId: string | null;
  settings: AgentControllerSessionSettings | null;
  /** Active project's resourceId — required to activate a model pack on its session. */
  resourceId?: string;
  onThemeChange: (theme: Theme) => void;
  onDensityChange: (density: Density) => void;
  onModelChange: (modelId: string) => void;
  /** Merge behavior settings into the server-side session state. */
  onBehaviorChange: (updates: Partial<AgentControllerSessionSettings>) => void;
  /** Read the session's current tool-permission rules. */
  getPermissions: () => Promise<PermissionRules>;
  /** Set a tool category's approval policy on the session. */
  setPermissionForCategory: (category: ToolCategory, policy: PermissionPolicy) => Promise<void>;
  onClose: () => void;
}

const TABS: { id: Tab; label: string; icon: LucideIcon }[] = [
  { id: 'general', label: 'General', icon: Palette },
  { id: 'model', label: 'Model', icon: Search },
  { id: 'packs', label: 'Packs', icon: Layers },
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
export function SettingsPanel({
  theme,
  density,
  models,
  currentModelId,
  settings,
  resourceId,
  onThemeChange,
  onDensityChange,
  onModelChange,
  onBehaviorChange,
  getPermissions,
  setPermissionForCategory,
  onClose,
}: SettingsPanelProps) {
  const [tab, setTab] = useState<Tab>('general');

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent className="w-full max-w-4xl h-[80vh]" aria-label="Settings">
        <DialogHeader className="px-5 pt-4 pb-2">
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>

        <Tabs<Tab> defaultTab="general" value={tab} onValueChange={setTab} className="flex flex-col min-h-0">
          <TabList className="px-5">
            {TABS.map(({ id, label, icon: Icon }) => (
              <Tab key={id} value={id}>
                <Icon size={15} />
                <span>{label}</span>
              </Tab>
            ))}
          </TabList>

          <div className="min-h-0 overflow-y-auto px-5">
            <TabContent value="general">
              <GeneralTab
                theme={theme}
                density={density}
                onThemeChange={onThemeChange}
                onDensityChange={onDensityChange}
              />
            </TabContent>
            <TabContent value="model">
              <ModelTab
                models={models}
                currentModelId={currentModelId}
                settings={settings}
                onModelChange={onModelChange}
                onBehaviorChange={onBehaviorChange}
              />
            </TabContent>
            <TabContent value="packs">
              <ModelPacksSection resourceId={resourceId} models={models} />
            </TabContent>
            <TabContent value="memory">
              <OMSection resourceId={resourceId} models={models} />
            </TabContent>
            <TabContent value="behavior">
              <BehaviorTab
                settings={settings}
                onBehaviorChange={onBehaviorChange}
                getPermissions={getPermissions}
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
