import { Txt } from '@mastra/playground-ui/components/Txt';
import { Brain, Hammer, Map, Wrench, Zap } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { useThinkingConfigQuery, useUpdateThinkingMutation } from '../../../../hooks/use-thinking';
import type { ThinkingLevelValue } from '../../../../hooks/use-thinking';
import { SettingsRow } from './SettingsCard';
import { SelectControl, THINKING_LEVELS } from './SettingsPanel.parts';

/** Sentinel for "no per-mode override — use the global default". */
const USE_GLOBAL = '__global__';

const MODE_ICONS: Record<string, LucideIcon> = { build: Hammer, plan: Map, fast: Zap };

function useThinkingSection() {
  const configQuery = useThinkingConfigQuery();
  const update = useUpdateThinkingMutation();
  const config = configQuery.data;
  const error = update.error ?? configQuery.error;
  const disabled = !config || update.isPending;
  return { config, update, error, disabled };
}

function ThinkingError({ error }: { error: unknown }) {
  if (!error) return null;
  return (
    <Txt as="p" variant="ui-xs" className="text-notice-destructive-fg px-4 pt-3">
      {error instanceof Error ? error.message : String(error)}
    </Txt>
  );
}

/**
 * The deployment-wide base thinking (reasoning-effort) level. Applied to every
 * run without a session or mode override — including automated Factory runs
 * (triage, board work items) nobody opens interactively.
 */
export function BaseThinkingSection() {
  const { config, update, error, disabled } = useThinkingSection();
  return (
    <>
      <ThinkingError error={error} />
      <SettingsRow
        label="Base thinking level"
        hint="Used by every run without a session or mode override"
        icon={<Brain size={14} />}
      >
        <SelectControl
          ariaLabel="Base thinking level"
          value={config?.globalDefault ?? 'off'}
          disabled={disabled}
          options={THINKING_LEVELS}
          onChange={level => update.mutate({ globalDefault: level })}
        />
      </SettingsRow>
    </>
  );
}

/**
 * Per-mode thinking (reasoning-effort) defaults for interactive chats. A mode
 * row set to "Global" inherits the base level from the Factory tab.
 */
export function ModeThinkingDefaultsSection() {
  const { config, update, error, disabled } = useThinkingSection();

  const modeOptions: { value: typeof USE_GLOBAL | ThinkingLevelValue; label: string }[] = [
    { value: USE_GLOBAL, label: 'Global' },
    ...THINKING_LEVELS,
  ];

  return (
    <>
      <ThinkingError error={error} />
      {(config?.modes ?? []).map(mode => {
        const ModeIcon = MODE_ICONS[mode] ?? Wrench;
        return (
          <SettingsRow
            key={mode}
            label={`${mode[0]?.toUpperCase()}${mode.slice(1)} mode`}
            hint={`Reasoning level for ${mode}-mode chats`}
            icon={<ModeIcon size={14} />}
            info="Levels the model doesn't support are clamped to the closest it does."
          >
            <SelectControl
              ariaLabel={`${mode} mode thinking level`}
              value={config?.modeDefaults[mode] ?? USE_GLOBAL}
              disabled={disabled}
              options={modeOptions}
              onChange={value =>
                update.mutate({
                  modeDefaults: { [mode]: value === USE_GLOBAL ? null : value },
                })
              }
            />
          </SettingsRow>
        );
      })}
    </>
  );
}
