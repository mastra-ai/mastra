import type {
  AgentControllerSessionSettings,
  PermissionPolicy,
  PermissionRules,
  ToolCategory,
} from '@mastra/client-js';
import { Switch } from '@mastra/playground-ui/components/Switch';
import { ThemeToggle } from '@mastra/playground-ui/components/ThemeToggle';
import { useState } from 'react';

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
              onChange={policy => void setPermissionForCategory(value, policy)}
            />
          </SettingsRow>
        ))}
      </SettingsCard>
    </SettingsSubsection>
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
