import type {
  AgentControllerAvailableModel,
  AgentControllerSessionSettings,
  PermissionPolicy,
  PermissionRules,
  ToolCategory,
} from '@mastra/client-js';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@mastra/playground-ui/components/Dialog';
import { Tab, TabContent, TabList, Tabs } from '@mastra/playground-ui/components/Tabs';
import type { Theme } from '@mastra/playground-ui/components/ThemeProvider';
import { Brain, Layers, LogIn, Palette, Search, Server, SlidersHorizontal } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useState } from 'react';

import type { Density } from '../services/density';
import { CustomProvidersSection } from './CustomProvidersSection';
import { ModelPacksSection } from './ModelPacksSection';
import { OMSection } from './OMSection';
import { ProvidersSection } from './ProvidersSection';
import { BehaviorTab, GeneralTab, ModelTab } from './SettingsPanel.parts';

export type SettingsTab = 'general' | 'model' | 'packs' | 'memory' | 'behavior' | 'providers' | 'custom-providers';

interface SettingsPanelProps {
  theme: Theme;
  density: Density;
  models: AgentControllerAvailableModel[];
  currentModelId: string | null;
  modelError?: string | null;
  settings: AgentControllerSessionSettings | null;
  /** Active project's resourceId — required to activate a model pack on its session. */
  resourceId?: string;
  onThemeChange: (theme: Theme) => void;
  onDensityChange: (density: Density) => void;
  onModelChange: (modelId: string) => void;
  /** Merge behavior settings into the server-side session state. */
  onBehaviorChange: (updates: Partial<AgentControllerSessionSettings>) => void;
  permissions: PermissionRules | null;
  pendingPermissionCategory: ToolCategory | null;
  /** Set a tool category's approval policy on the session. */
  setPermissionForCategory: (category: ToolCategory, policy: PermissionPolicy) => Promise<void>;
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
export function SettingsPanel({
  theme,
  models,
  currentModelId,
  modelError,
  settings,
  resourceId,
  onThemeChange,
  onModelChange,
  onBehaviorChange,
  permissions,
  pendingPermissionCategory,
  setPermissionForCategory,
  initialTab = 'general',
  onClose,
}: SettingsPanelProps) {
  const [tab, setTab] = useState<SettingsTab>(initialTab);

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
              <GeneralTab theme={theme} onThemeChange={onThemeChange} />
            </TabContent>
            <TabContent value="model">
              <ModelTab
                models={models}
                currentModelId={currentModelId}
                error={modelError}
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
                permissions={permissions}
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
