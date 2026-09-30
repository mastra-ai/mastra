import type {
  AgentControllerSessionSettings,
  PermissionPolicy,
  PermissionRules,
  ToolCategory,
} from '@mastra/client-js';
import { SegmentedControl, SegmentedControlItem } from '@mastra/playground-ui/components/SegmentedControl';
import { Switch } from '@mastra/playground-ui/components/Switch';
import { ThemeToggle } from '@mastra/playground-ui/components/ThemeToggle';
import { useState } from 'react';

import { loadDoneSound, playDoneSound, saveDoneSound } from '../services/doneSound';
import type { DoneSound } from '../services/doneSound';
import { SettingsContainer, SettingsRow } from '@mastra/playground-ui/new/settings';

import { SettingsSubsection } from './SettingsSubsection';
import { SoundPicker, ThinkingLevelPicker } from './SettingsFields';

export function GeneralSettings() {
  const [doneSound, setDoneSound] = useState<DoneSound>(() => loadDoneSound());
  const changeDoneSound = (next: DoneSound) => {
    setDoneSound(next);
    saveDoneSound(next);

    playDoneSound(next);
  };
  return (
    <SettingsSubsection scope="personal" title="General" description="Stored in this browser.">
      <SettingsContainer>
        <SettingsRow label="Theme" description="Color scheme for the interface">
          <ThemeToggle />
        </SettingsRow>
        <SettingsRow label="Completion sound" description="Played when an agent run finishes in a workspace">
          <SoundPicker value={doneSound} onChange={changeDoneSound} />
        </SettingsRow>
      </SettingsContainer>
    </SettingsSubsection>
  );
}

interface ModelSettingsProps {
  settings: AgentControllerSessionSettings | null;
  onBehaviorChange: (updates: Partial<AgentControllerSessionSettings>) => Promise<unknown>;
}

export function ModelSettings({ settings, onBehaviorChange }: ModelSettingsProps) {
  return (
    <SettingsRow label="Thinking level" description="Reasoning budget for your chats — overrides the Factory defaults">
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
  setPermissionForCategory: (category: ToolCategory, policy: PermissionPolicy) => Promise<void>;
}

export function BehaviorSettings({
  settings,
  onBehaviorChange,
  permissions,
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
        <SettingsContainer>
          <SettingsRow label="Auto-approve tools" description="Run tool calls without asking (YOLO)">
            <Toggle
              ariaLabel="Auto-approve tools"
              checked={!!settings?.yolo}
              disabled={!settings}
              onChange={v => onBehaviorChange({ yolo: v })}
            />
          </SettingsRow>
          <SettingsRow label="Smart editing" description="Use AST-aware edits when available">
            <Toggle
              ariaLabel="Smart editing"
              checked={!!settings?.smartEditing}
              disabled={!settings}
              onChange={v => onBehaviorChange({ smartEditing: v })}
            />
          </SettingsRow>
          <SettingsRow label="Notifications" description="How completion alerts are delivered">
            <SegmentedControl
              aria-label="Notifications"
              value={notificationMode}
              disabled={!settings}
              onValueChange={v => onBehaviorChange({ notifications: v })}
            >
              <SegmentedControlItem value="off">Off</SegmentedControlItem>
              <SegmentedControlItem value="bell">Bell</SegmentedControlItem>
              <SegmentedControlItem value="system">System</SegmentedControlItem>
              <SegmentedControlItem value="both">Both</SegmentedControlItem>
            </SegmentedControl>
          </SettingsRow>
        </SettingsContainer>
      </SettingsSubsection>
      <PermissionsSection permissions={permissions} setPermissionForCategory={setPermissionForCategory} />
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
function PermissionsSection({
  permissions,
  setPermissionForCategory,
}: Pick<BehaviorSettingsProps, 'permissions' | 'setPermissionForCategory'>) {
  return (
    <SettingsSubsection
      scope="factory"
      title="Tool permissions"
      description="“Allow” runs without asking, “Ask” prompts you, “Deny” blocks it. Auto-approve above sets every category to Allow. Shared by everyone working in this Factory, and reset when the server restarts."
    >
      <SettingsContainer>
        {TOOL_CATEGORIES.map(({ value, label, hint }) => (
          <SettingsRow key={value} label={label} description={hint}>
            <PermissionPolicyControl
              category={label}
              policy={permissions?.categories?.[value] ?? 'ask'}
              disabled={!permissions}
              onChange={policy => void setPermissionForCategory(value, policy)}
            />
          </SettingsRow>
        ))}
      </SettingsContainer>
    </SettingsSubsection>
  );
}

function PermissionPolicyControl({
  category,
  policy,
  disabled,
  onChange,
}: {
  category: string;
  policy: PermissionPolicy;
  disabled: boolean;
  onChange: (policy: PermissionPolicy) => void;
}) {
  return (
    <SegmentedControl aria-label={`${category} permission`} value={policy} disabled={disabled} onValueChange={onChange}>
      <SegmentedControlItem value="allow">Allow</SegmentedControlItem>
      <SegmentedControlItem value="ask">Ask</SegmentedControlItem>
      <SegmentedControlItem value="deny">Deny</SegmentedControlItem>
    </SegmentedControl>
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
