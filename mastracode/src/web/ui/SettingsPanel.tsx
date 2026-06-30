import type {
  AgentControllerAvailableModel,
  AgentControllerSessionSettings,
  PermissionPolicy,
  PermissionRules,
  ToolCategory,
} from '@mastra/client-js';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactElement } from 'react';

import { CustomProvidersSection } from './CustomProvidersSection';
import {
  BrainIcon,
  CheckIcon,
  CloseIcon,
  KeyIcon,
  LayersIcon,
  PaletteIcon,
  SearchIcon,
  ServerIcon,
  SlidersIcon,
} from './icons';
import { ModelPacksSection } from './ModelPacksSection';
import { OMSection } from './OMSection';
import { ProvidersSection } from './ProvidersSection';
import type { Density, Theme } from './theme';

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

const TABS: { id: Tab; label: string; icon: (p: { size?: number }) => ReactElement }[] = [
  { id: 'general', label: 'General', icon: PaletteIcon },
  { id: 'model', label: 'Model', icon: SearchIcon },
  { id: 'packs', label: 'Packs', icon: LayersIcon },
  { id: 'memory', label: 'Memory', icon: BrainIcon },
  { id: 'behavior', label: 'Behavior', icon: SlidersIcon },
  { id: 'providers', label: 'API Keys', icon: KeyIcon },
  { id: 'custom-providers', label: 'Custom', icon: ServerIcon },
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
    <div className="palette-overlay" onClick={onClose}>
      <div
        className="settings-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        onClick={e => e.stopPropagation()}
      >
        <header className="settings-modal-head">
          <h2 className="settings-modal-title">Settings</h2>
          <button className="settings-modal-close" onClick={onClose} aria-label="Close settings">
            <CloseIcon size={16} />
          </button>
        </header>

        <div className="settings-modal-body">
          <nav className="settings-nav" aria-label="Settings sections">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                className={`settings-nav-item ${tab === id ? 'active' : ''}`}
                aria-current={tab === id}
                onClick={() => setTab(id)}
              >
                <Icon size={15} />
                <span>{label}</span>
              </button>
            ))}
          </nav>

          <div className="settings-pane">
            {tab === 'general' && (
              <GeneralTab
                theme={theme}
                density={density}
                onThemeChange={onThemeChange}
                onDensityChange={onDensityChange}
              />
            )}
            {tab === 'model' && (
              <ModelTab
                models={models}
                currentModelId={currentModelId}
                settings={settings}
                onModelChange={onModelChange}
                onBehaviorChange={onBehaviorChange}
              />
            )}
            {tab === 'packs' && <ModelPacksSection resourceId={resourceId} models={models} />}
            {tab === 'memory' && <OMSection resourceId={resourceId} models={models} />}
            {tab === 'behavior' && (
              <BehaviorTab
                settings={settings}
                onBehaviorChange={onBehaviorChange}
                getPermissions={getPermissions}
                setPermissionForCategory={setPermissionForCategory}
              />
            )}
            {tab === 'providers' && <ProvidersSection />}
            {tab === 'custom-providers' && <CustomProvidersSection />}
          </div>
        </div>
      </div>
    </div>
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
      <FieldRow label="Theme" hint="Color scheme for the interface" first>
        <Segmented
          ariaLabel="Theme"
          value={theme}
          options={[
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
      <div className="settings-field first">
        <div className="settings-field-label">
          <span>Model</span>
          <span className="settings-hint">Default model for this session</span>
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
      <FieldRow label="Auto-approve tools" hint="Run tool calls without asking (YOLO)" first>
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
    <div className="settings-subsection">
      <div className="settings-subsection-title">Tool permissions</div>
      <p className="settings-subsection-hint">
        Choose how each tool category is approved. “Allow” runs without asking, “Ask” prompts you, “Deny” blocks it.
        Turning on “Auto-approve tools” above sets every category to Allow.
      </p>
      {TOOL_CATEGORIES.map(({ value, label, hint }, i) => (
        <FieldRow key={value} label={label} hint={hint} first={i === 0}>
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
    return <div className="model-empty">No models available.</div>;
  }

  return (
    <div className="model-picker" ref={rootRef}>
      <button
        type="button"
        className="model-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
      >
        <span className="model-trigger-label">{currentLabel}</span>
        <span className="model-trigger-caret" aria-hidden>
          ▾
        </span>
      </button>

      {open && (
        <div className="model-popover" role="dialog" aria-label="Choose a model">
          <div className="model-search">
            <SearchIcon size={14} className="model-search-icon" />
            <input
              ref={inputRef}
              className="model-search-input"
              placeholder="Search models or providers…"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={onKeyDown}
              aria-label="Search models"
            />
          </div>
          <ul className="model-list" role="listbox" aria-label="Models">
            {filtered.length === 0 && <li className="model-list-empty">No models match “{query}”.</li>}
            {filtered.slice(0, 100).map((m, i) => (
              <li key={m.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={m.id === currentModelId}
                  className={`model-option ${i === active ? 'active' : ''} ${m.hasApiKey ? '' : 'locked'}`}
                  disabled={!m.hasApiKey}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => choose(m)}
                >
                  <span className="model-option-main">
                    <span className="model-option-name">{m.modelName}</span>
                    <span className="model-option-provider">{m.provider}</span>
                  </span>
                  {m.id === currentModelId ? (
                    <CheckIcon size={14} className="model-option-check" />
                  ) : m.hasApiKey ? null : (
                    <span className="model-option-tag">no key</span>
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

function FieldRow({
  label,
  hint,
  first,
  children,
}: {
  label: string;
  hint?: string;
  first?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={`settings-field ${first ? 'first' : ''}`}>
      <div className="settings-field-label">
        <span>{label}</span>
        {hint && <span className="settings-hint">{hint}</span>}
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
    <div className="seg" role="group" aria-label={ariaLabel}>
      {options.map(o => (
        <button
          key={o.value}
          className={`seg-btn ${value === o.value ? 'active' : ''}`}
          aria-pressed={value === o.value}
          disabled={disabled}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
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
    <button
      className={`toggle ${checked ? 'on' : ''}`}
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onChange(!checked)}
    >
      <span className="toggle-knob" />
    </button>
  );
}
