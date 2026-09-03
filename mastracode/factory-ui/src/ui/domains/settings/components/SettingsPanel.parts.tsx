import type {
  AgentControllerAvailableModel,
  AgentControllerSessionSettings,
  PermissionPolicy,
  PermissionRules,
  ToolCategory,
} from '@mastra/client-js';
import { Badge } from '@mastra/playground-ui/components/Badge';
import { Button } from '@mastra/playground-ui/components/Button';
import { Input } from '@mastra/playground-ui/components/Input';
import { Switch } from '@mastra/playground-ui/components/Switch';
import { ThemeToggle } from '@mastra/playground-ui/components/ThemeToggle';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { cn } from '@mastra/playground-ui/utils/cn';
import { Check } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { loadDoneSound, playDoneSound, saveDoneSound } from '../services/doneSound';
import type { DoneSound } from '../services/doneSound';
import { SettingsRow } from '@mastra/playground-ui/components/SettingsRow';
import { SettingsCard } from './SettingsCard';
import { SettingsSubsection } from './SettingsSubsection';
import { Segmented, SoundPicker, ThinkingLevelPicker } from './SettingsFields';

type NotificationMode = AgentControllerSessionSettings['notifications'];
const NOTIFICATION_MODES: { value: NotificationMode; label: string }[] = [
  { value: 'off', label: 'Off' },
  { value: 'bell', label: 'Bell' },
  { value: 'system', label: 'System' },
  { value: 'both', label: 'Both' },
];

export function GeneralSettings() {
  const [doneSound, setDoneSound] = useState<DoneSound>(() => loadDoneSound());
  const changeDoneSound = (next: DoneSound) => {
    setDoneSound(next);
    saveDoneSound(next);
    // Preview the pick so the user hears what they chose.
    playDoneSound(next);
  };
  return (
    <SettingsSubsection scope="personal" title="General" description="Stored in this browser.">
      <SettingsCard>
        <SettingsRow variant="factory" label="Theme" description="Color scheme for the interface">
          <ThemeToggle />
        </SettingsRow>
        <SettingsRow
          variant="factory"
          label="Completion sound"
          description="Played when an agent run finishes in a workspace"
        >
          <SoundPicker value={doneSound} onChange={changeDoneSound} />
        </SettingsRow>
      </SettingsCard>
    </SettingsSubsection>
  );
}

interface ModelSettingsProps {
  settings: AgentControllerSessionSettings | null;
  onBehaviorChange: (updates: Partial<AgentControllerSessionSettings>) => Promise<unknown>;
}

export function ModelSettings({ settings, onBehaviorChange }: ModelSettingsProps) {
  return (
    <SettingsRow
      variant="factory"
      label="Thinking level"
      description="Reasoning budget for your chats — overrides the Factory defaults"
    >
      <ThinkingLevelPicker
        ariaLabel="Thinking level"
        value={settings?.thinkingLevel ?? 'off'}
        disabled={!settings}
        onChange={level => onBehaviorChange({ thinkingLevel: level ?? 'off' })}
      />
    </SettingsRow>
  );
}

interface BehaviorSettingsProps {
  settings: AgentControllerSessionSettings | null;
  onBehaviorChange: (updates: Partial<AgentControllerSessionSettings>) => Promise<unknown>;
  permissions: PermissionRules | null;
  pendingPermissionCategory: ToolCategory | null;
  setPermissionForCategory: (category: ToolCategory, policy: PermissionPolicy) => Promise<void>;
}

export function BehaviorSettings({
  settings,
  onBehaviorChange,
  permissions,
  pendingPermissionCategory,
  setPermissionForCategory,
}: BehaviorSettingsProps) {
  const notificationMode = settings?.notifications ?? 'off';
  return (
    <div className="flex flex-col gap-8">
      <SettingsSubsection
        scope="factory"
        title="General"
        description="Shared by everyone working in this Factory. Auto-approve and smart editing reset when the server restarts."
      >
        <SettingsCard>
          <SettingsRow variant="factory" label="Auto-approve tools" description="Run tool calls without asking (YOLO)">
            <Toggle
              ariaLabel="Auto-approve tools"
              checked={!!settings?.yolo}
              disabled={!settings}
              onChange={v => onBehaviorChange({ yolo: v })}
            />
          </SettingsRow>
          <SettingsRow variant="factory" label="Smart editing" description="Use AST-aware edits when available">
            <Toggle
              ariaLabel="Smart editing"
              checked={!!settings?.smartEditing}
              disabled={!settings}
              onChange={v => onBehaviorChange({ smartEditing: v })}
            />
          </SettingsRow>
          <SettingsRow variant="factory" label="Notifications" description="How completion alerts are delivered">
            <Segmented
              ariaLabel="Notifications"
              value={notificationMode}
              disabled={!settings}
              options={NOTIFICATION_MODES}
              onChange={v => onBehaviorChange({ notifications: v })}
            />
          </SettingsRow>
        </SettingsCard>
      </SettingsSubsection>
      <PermissionsSection
        permissions={permissions}
        pendingPermissionCategory={pendingPermissionCategory}
        setPermissionForCategory={setPermissionForCategory}
      />
    </div>
  );
}

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
  permissions,
  pendingPermissionCategory,
  setPermissionForCategory,
}: Pick<BehaviorSettingsProps, 'permissions' | 'pendingPermissionCategory' | 'setPermissionForCategory'>) {
  const update = async (category: ToolCategory, policy: PermissionPolicy) => {
    await setPermissionForCategory(category, policy);
  };

  return (
    <SettingsSubsection
      scope="factory"
      title="Tool permissions"
      description="“Allow” runs without asking, “Ask” prompts you, “Deny” blocks it. Auto-approve above sets every category to Allow. Shared by everyone working in this Factory, and reset when the server restarts."
    >
      <SettingsCard>
        {TOOL_CATEGORIES.map(({ value, label, hint }) => (
          <SettingsRow variant="factory" key={value} label={label} description={hint}>
            <Segmented
              ariaLabel={`${label} permission`}
              value={permissions?.categories?.[value] ?? 'ask'}
              disabled={!permissions || pendingPermissionCategory === value}
              options={PERMISSION_POLICIES}
              onChange={policy => void update(value, policy)}
            />
          </SettingsRow>
        ))}
      </SettingsCard>
    </SettingsSubsection>
  );
}

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

  const q = query.trim().toLowerCase();
  const matched = q
    ? models.filter(
        m =>
          m.provider.toLowerCase().includes(q) ||
          m.modelName.toLowerCase().includes(q) ||
          m.id.toLowerCase().includes(q),
      )
    : models;
  const filtered = [...matched].sort((a, b) => {
    if (a.hasApiKey !== b.hasApiKey) return a.hasApiKey ? -1 : 1;
    return a.id.localeCompare(b.id);
  });

  // Open/close is an event, not a synchronization: reset search state in the
  // handlers that trigger it instead of reacting via effects.
  const openPicker = () => {
    setQuery('');
    setActive(0);
    setOpen(true);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const updateQuery = (next: string) => {
    setQuery(next);
    setActive(0);
  };

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
        onClick={() => (open ? setOpen(false) : openPicker())}
      >
        <span className="truncate">{currentLabel}</span>
        <span aria-hidden>▾</span>
      </Button>

      {open && (
        <div
          className="border-border1/60 bg-surface3 shadow-dialog absolute z-50 mt-1 w-full rounded-lg border"
          role="dialog"
          aria-label="Choose a model"
        >
          <div className="border-border1/40 border-b p-2">
            <Input
              ref={inputRef}
              placeholder="Search models or providers…"
              value={query}
              onChange={e => updateQuery(e.target.value)}
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
                  className={cn(
                    'flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left',
                    i === active && 'bg-surface4',
                    m.hasApiKey ? 'cursor-pointer' : 'cursor-not-allowed opacity-50',
                  )}
                  disabled={!m.hasApiKey}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => choose(m)}
                >
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <Txt variant="ui-md" className="text-icon6 truncate">
                      {m.modelName}
                    </Txt>
                    <Txt variant="ui-sm" className="text-icon3 truncate">
                      {m.provider}
                    </Txt>
                  </span>
                  {m.id === currentModelId ? <Check size={14} /> : m.hasApiKey ? null : <Badge>no key</Badge>}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
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
    <Switch aria-label={ariaLabel} checked={checked} disabled={disabled} onCheckedChange={value => onChange(value)} />
  );
}
