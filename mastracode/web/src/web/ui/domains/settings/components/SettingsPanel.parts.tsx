import type {
  AgentControllerAvailableModel,
  AgentControllerSessionSettings,
  PermissionPolicy,
  PermissionRules,
  ToolCategory,
} from '@mastra/client-js';
import { Badge } from '@mastra/playground-ui/components/Badge';
import { Button } from '@mastra/playground-ui/components/Button';
import { ButtonsGroup } from '@mastra/playground-ui/components/ButtonsGroup';
import { Input } from '@mastra/playground-ui/components/Input';
import { Switch } from '@mastra/playground-ui/components/Switch';
import type { Theme } from '@mastra/playground-ui/components/ThemeProvider';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { cn } from '@mastra/playground-ui/utils/cn';
import { Check } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { DONE_SOUND_OPTIONS, loadDoneSound, playDoneSound, saveDoneSound } from '../services/doneSound';
import type { DoneSound } from '../services/doneSound';

type ThinkingLevel = AgentControllerSessionSettings['thinkingLevel'];
type NotificationMode = AgentControllerSessionSettings['notifications'];

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

interface GeneralSettingsProps {
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
}

export function GeneralSettings({ theme, onThemeChange }: GeneralSettingsProps) {
  const [doneSound, setDoneSound] = useState<DoneSound>(() => loadDoneSound());
  const changeDoneSound = (next: DoneSound) => {
    setDoneSound(next);
    saveDoneSound(next);
    // Preview the pick so the user hears what they chose.
    playDoneSound(next);
  };
  return (
    <FieldRowGroup>
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
      <FieldRow label="Completion sound" hint="Played when an agent run finishes in a workspace">
        <Segmented
          ariaLabel="Completion sound"
          value={doneSound}
          options={DONE_SOUND_OPTIONS}
          onChange={changeDoneSound}
        />
      </FieldRow>
    </FieldRowGroup>
  );
}

interface ModelSettingsProps {
  settings: AgentControllerSessionSettings | null;
  updating: boolean;
  onBehaviorChange: (updates: Partial<AgentControllerSessionSettings>) => void;
}

export function ModelSettings({ settings, updating, onBehaviorChange }: ModelSettingsProps) {
  return (
    <FieldRowGroup>
      <FieldRow label="Thinking level" hint="Extended-reasoning budget for the agent">
        <Segmented
          ariaLabel="Thinking level"
          value={settings?.thinkingLevel ?? 'off'}
          disabled={!settings || updating}
          options={THINKING_LEVELS}
          onChange={v => onBehaviorChange({ thinkingLevel: v })}
        />
      </FieldRow>
    </FieldRowGroup>
  );
}

interface BehaviorSettingsProps {
  settings: AgentControllerSessionSettings | null;
  updating: boolean;
  onBehaviorChange: (updates: Partial<AgentControllerSessionSettings>) => void;
  permissions: PermissionRules | null;
  pendingPermissionCategory: ToolCategory | null;
  setPermissionForCategory: (category: ToolCategory, policy: PermissionPolicy) => Promise<void>;
}

export function BehaviorSettings({
  settings,
  updating,
  onBehaviorChange,
  permissions,
  pendingPermissionCategory,
  setPermissionForCategory,
}: BehaviorSettingsProps) {
  const notificationMode = settings?.notifications ?? 'off';
  return (
    <>
      <FieldRowGroup>
        <FieldRow label="Auto-approve tools" hint="Run tool calls without asking (YOLO)">
          <Toggle
            ariaLabel="Auto-approve tools"
            checked={!!settings?.yolo}
            disabled={!settings || updating}
            onChange={v => onBehaviorChange({ yolo: v })}
          />
        </FieldRow>
        <FieldRow label="Smart editing" hint="Use AST-aware edits when available">
          <Toggle
            ariaLabel="Smart editing"
            checked={!!settings?.smartEditing}
            disabled={!settings || updating}
            onChange={v => onBehaviorChange({ smartEditing: v })}
          />
        </FieldRow>
        <FieldRow label="Notifications" hint="How completion alerts are delivered">
          <Segmented
            ariaLabel="Notifications"
            value={notificationMode}
            disabled={!settings || updating}
            options={NOTIFICATION_MODES}
            onChange={v => onBehaviorChange({ notifications: v })}
          />
        </FieldRow>
      </FieldRowGroup>
      <PermissionsSection
        permissions={permissions}
        pendingPermissionCategory={pendingPermissionCategory}
        setPermissionForCategory={setPermissionForCategory}
      />
    </>
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
    <div className="mt-6 pt-4">
      <Txt variant="ui-lg" className="text-icon6 font-medium">
        Tool permissions
      </Txt>
      <Txt variant="ui-sm" as="p" className="mt-1 mb-2 text-icon3">
        Choose how each tool category is approved. “Allow” runs without asking, “Ask” prompts you, “Deny” blocks it.
        Turning on “Auto-approve tools” above sets every category to Allow.
      </Txt>
      <FieldRowGroup>
        {TOOL_CATEGORIES.map(({ value, label, hint }) => (
          <FieldRow key={value} label={label} hint={hint}>
            <Segmented
              ariaLabel={`${label} permission`}
              value={permissions?.categories?.[value] ?? 'ask'}
              disabled={!permissions || pendingPermissionCategory === value}
              options={PERMISSION_POLICIES}
              onChange={policy => void update(value, policy)}
            />
          </FieldRow>
        ))}
      </FieldRowGroup>
    </div>
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
          className="absolute z-50 mt-1 w-full rounded-lg border border-border1/60 bg-surface3 shadow-dialog"
          role="dialog"
          aria-label="Choose a model"
        >
          <div className="p-2 border-b border-border1/40">
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

function FieldRowGroup({ children }: { children: React.ReactNode }) {
  return <div className="divide-y divide-border1/40">{children}</div>;
}

function FieldRow({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
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
