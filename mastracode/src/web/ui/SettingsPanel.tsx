import type {
  AgentControllerAvailableModel,
  AgentControllerSessionSettings,
  PermissionPolicy,
  PermissionRules,
  ToolCategory,
} from '@mastra/client-js';
import {
  Badge,
  Button,
  ButtonsGroup,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Input,
  Switch,
  Tab,
  TabContent,
  TabList,
  Tabs,
  Txt,
} from '@mastra/playground-ui';
import type { Theme } from '@mastra/playground-ui';
import { Brain, Check, Key, Layers, Palette, Search, Server, SlidersHorizontal } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { CustomProvidersSection } from './CustomProvidersSection';
import { ModelPacksSection } from './ModelPacksSection';
import { OMSection } from './OMSection';
import { ProvidersSection } from './ProvidersSection';
import type { Density } from './theme';

type ThinkingLevel = AgentControllerSessionSettings['thinkingLevel'];
type NotificationMode = AgentControllerSessionSettings['notifications'];
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

const THINKING_LEVELS: { value: ThinkingLevel; label: string }[] = [
  { value: 'off', label: 'Off' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'xhigh', label: 'Extra high' },
];
const NOTIFICATION_MODES: { value: NotificationMode; label: string }[] = [
  { value: 'off', label: 'Off' },
  { value: 'bell', label: 'Bell' },
  { value: 'system', label: 'System' },
  { value: 'both', label: 'Both' },
];

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

/* ── Tabs ──────────────────────────────────────────────────────────────── */

function GeneralTab({
  theme,
  density,
  onThemeChange,
  onDensityChange,
}: Pick<SettingsPanelProps, 'theme' | 'density' | 'onThemeChange' | 'onDensityChange'>) {
  return (
    <>
      <FieldRow label="Theme" hint="Color scheme for the interface">
        <Segmented
          ariaLabel="Theme"
          value={theme}
          options={[
            { value: 'system', label: 'System' },
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' },
          ]}
          onChange={onThemeChange}
        />
      </FieldRow>
      <FieldRow label="Density" hint="Spacing between messages and controls">
        <Segmented
          ariaLabel="Density"
          value={density}
          options={[
            { value: 'comfortable', label: 'Comfortable' },
            { value: 'compact', label: 'Compact' },
          ]}
          onChange={onDensityChange}
        />
      </FieldRow>
    </>
  );
}

function ModelTab({
  models,
  currentModelId,
  settings,
  onModelChange,
  onBehaviorChange,
}: Pick<SettingsPanelProps, 'models' | 'currentModelId' | 'settings' | 'onModelChange' | 'onBehaviorChange'>) {
  return (
    <>
      <div className="flex flex-col gap-2 py-3 border-b border-border1/40">
        <div className="flex flex-col gap-0.5">
          <Txt variant="ui-md" className="text-icon5">
            Model
          </Txt>
          <Txt variant="ui-sm" className="text-icon3">
            Default model for this session
          </Txt>
        </div>
        <ModelPicker models={models} currentModelId={currentModelId} onModelChange={onModelChange} />
      </div>

      <FieldRow label="Thinking level" hint="Extended-reasoning budget for the agent">
        <Segmented
          ariaLabel="Thinking level"
          value={settings?.thinkingLevel ?? 'off'}
          disabled={!settings}
          options={THINKING_LEVELS}
          onChange={v => onBehaviorChange({ thinkingLevel: v })}
        />
      </FieldRow>
    </>
  );
}

function BehaviorTab({
  settings,
  onBehaviorChange,
  getPermissions,
  setPermissionForCategory,
}: Pick<SettingsPanelProps, 'settings' | 'onBehaviorChange' | 'getPermissions' | 'setPermissionForCategory'>) {
  return (
    <>
      <FieldRow label="Auto-approve tools" hint="Run tool calls without asking (YOLO)">
        <Toggle
          ariaLabel="Auto-approve tools"
          checked={!!settings?.yolo}
          disabled={!settings}
          onChange={v => onBehaviorChange({ yolo: v })}
        />
      </FieldRow>
      <FieldRow label="Smart editing" hint="Use AST-aware edits when available">
        <Toggle
          ariaLabel="Smart editing"
          checked={!!settings?.smartEditing}
          disabled={!settings}
          onChange={v => onBehaviorChange({ smartEditing: v })}
        />
      </FieldRow>
      <FieldRow label="Notifications" hint="How completion alerts are delivered">
        <Segmented
          ariaLabel="Notifications"
          value={settings?.notifications ?? 'off'}
          disabled={!settings}
          options={NOTIFICATION_MODES}
          onChange={v => onBehaviorChange({ notifications: v })}
        />
      </FieldRow>
      <PermissionsSection getPermissions={getPermissions} setPermissionForCategory={setPermissionForCategory} />
    </>
  );
}

/* ── Per-category tool permissions ─────────────────────────────────────── */

const TOOL_CATEGORIES: { value: ToolCategory; label: string; hint: string }[] = [
  { value: 'read', label: 'Read', hint: 'View files and inspect the workspace' },
  { value: 'edit', label: 'Edit', hint: 'Create, modify, or delete files' },
  { value: 'execute', label: 'Execute', hint: 'Run shell commands' },
  { value: 'mcp', label: 'MCP', hint: 'Call tools from MCP servers' },
  { value: 'other', label: 'Other', hint: 'Anything not in the above categories' },
];
const PERMISSION_POLICIES: { value: PermissionPolicy; label: string }[] = [
  { value: 'allow', label: 'Allow' },
  { value: 'ask', label: 'Ask' },
  { value: 'deny', label: 'Deny' },
];

function PermissionsSection({
  getPermissions,
  setPermissionForCategory,
}: Pick<SettingsPanelProps, 'getPermissions' | 'setPermissionForCategory'>) {
  const [rules, setRules] = useState<PermissionRules | null>(null);
  const [busy, setBusy] = useState<ToolCategory | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getPermissions().then(r => {
      if (!cancelled) setRules(r);
    });
    return () => {
      cancelled = true;
    };
  }, [getPermissions]);

  const update = async (category: ToolCategory, policy: PermissionPolicy) => {
    setBusy(category);
    // Optimistic: reflect the choice immediately, reconcile from the server after.
    setRules(prev => ({
      ...prev,
      categories: { ...prev?.categories, [category]: policy },
    }));
    try {
      await setPermissionForCategory(category, policy);
      const fresh = await getPermissions();
      setRules(fresh);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mt-6 pt-4 border-t border-border1/40">
      <Txt variant="ui-lg" className="text-icon6 font-medium">
        Tool permissions
      </Txt>
      <Txt variant="ui-sm" as="p" className="mt-1 mb-2 text-icon3">
        Choose how each tool category is approved. “Allow” runs without asking, “Ask” prompts you, “Deny” blocks it.
        Turning on “Auto-approve tools” above sets every category to Allow.
      </Txt>
      {TOOL_CATEGORIES.map(({ value, label, hint }) => (
        <FieldRow key={value} label={label} hint={hint}>
          <Segmented
            ariaLabel={`${label} permission`}
            value={rules?.categories?.[value] ?? 'ask'}
            disabled={!rules || busy === value}
            options={PERMISSION_POLICIES}
            onChange={policy => void update(value, policy)}
          />
        </FieldRow>
      ))}
    </div>
  );
}

/* ── Searchable model combobox ─────────────────────────────────────────── */

function ModelPicker({
  models,
  currentModelId,
  onModelChange,
}: {
  models: AgentControllerAvailableModel[];
  currentModelId: string | null;
  onModelChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const current = models.find(m => m.id === currentModelId);
  const currentLabel = current ? `${current.provider} / ${current.modelName}` : (currentModelId ?? 'Select a model');

  // Usable models (with keys) first, then the rest — searchable across provider + name.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matched = q
      ? models.filter(
          m =>
            m.provider.toLowerCase().includes(q) ||
            m.modelName.toLowerCase().includes(q) ||
            m.id.toLowerCase().includes(q),
        )
      : models;
    return [...matched].sort((a, b) => {
      if (a.hasApiKey !== b.hasApiKey) return a.hasApiKey ? -1 : 1;
      return a.id.localeCompare(b.id);
    });
  }, [models, query]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActive(0);
      // Focus the search field after the popover mounts.
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  const choose = (m: AgentControllerAvailableModel) => {
    if (!m.hasApiKey) return;
    onModelChange(m.id);
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive(a => Math.min(a + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive(a => Math.max(a - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const m = filtered[active];
      if (m) choose(m);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
    }
  };

  if (models.length === 0) {
    return (
      <Txt variant="ui-sm" className="text-icon3">
        No models available.
      </Txt>
    );
  }

  return (
    <div className="relative" ref={rootRef}>
      <Button
        variant="outline"
        size="md"
        className="w-full justify-between"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
      >
        <span className="truncate">{currentLabel}</span>
        <span aria-hidden>▾</span>
      </Button>

      {open && (
        <div
          className="absolute z-50 mt-1 w-full rounded-lg border border-border1/60 bg-surface3 shadow-dialog"
          role="dialog"
          aria-label="Choose a model"
        >
          <div className="p-2 border-b border-border1/40">
            <Input
              ref={inputRef}
              placeholder="Search models or providers…"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={onKeyDown}
              aria-label="Search models"
            />
          </div>
          <ul className="max-h-72 overflow-y-auto p-1" role="listbox" aria-label="Models">
            {filtered.length === 0 && (
              <li className="px-3 py-2">
                <Txt variant="ui-sm" className="text-icon3">
                  No models match “{query}”.
                </Txt>
              </li>
            )}
            {filtered.slice(0, 100).map((m, i) => (
              <li key={m.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={m.id === currentModelId}
                  className={`flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left ${i === active ? 'bg-surface4' : ''} ${m.hasApiKey ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}`}
                  disabled={!m.hasApiKey}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => choose(m)}
                >
                  <span className="flex flex-col gap-0.5 min-w-0">
                    <Txt variant="ui-md" className="text-icon6 truncate">
                      {m.modelName}
                    </Txt>
                    <Txt variant="ui-sm" className="text-icon3 truncate">
                      {m.provider}
                    </Txt>
                  </span>
                  {m.id === currentModelId ? (
                    <Check size={14} />
                  ) : m.hasApiKey ? null : (
                    <Badge variant="default">no key</Badge>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/* ── Small presentational primitives ───────────────────────────────────── */

function FieldRow({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 border-b border-border1/40">
      <div className="flex flex-col gap-0.5">
        <Txt variant="ui-md" className="text-icon5">
          {label}
        </Txt>
        {hint && (
          <Txt variant="ui-sm" className="text-icon3">
            {hint}
          </Txt>
        )}
      </div>
      {children}
    </div>
  );
}

function Segmented<T extends string>({
  value,
  options,
  ariaLabel,
  disabled,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  ariaLabel: string;
  disabled?: boolean;
  onChange: (value: T) => void;
}) {
  return (
    <ButtonsGroup spacing="close" role="group" aria-label={ariaLabel}>
      {options.map(o => (
        <Button
          key={o.value}
          variant={value === o.value ? 'primary' : 'outline'}
          size="sm"
          aria-pressed={value === o.value}
          disabled={disabled}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </Button>
      ))}
    </ButtonsGroup>
  );
}

function Toggle({
  checked,
  ariaLabel,
  disabled,
  onChange,
}: {
  checked: boolean;
  ariaLabel: string;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <Switch aria-label={ariaLabel} checked={checked} disabled={disabled} onCheckedChange={value => onChange(value)} />
  );
}
