import { Txt } from '@mastra/playground-ui/components/Txt';

import { useThinkingConfigQuery, useUpdateThinkingMutation } from '../../../../hooks/use-thinking';
import type { ThinkingLevelValue } from '../../../../hooks/use-thinking';
import { SettingsRow } from '@mastra/playground-ui/components/SettingsRow';
import { Segmented, SegmentedSelect, THINKING_LEVELS } from './SettingsPanel.parts';

/** Sentinel for "no per-mode override — use the global default". */
const USE_GLOBAL = '__global__';

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
        variant="factory"
        label="Base thinking level"
        description="Used by every run without a session or mode override"
      >
        <div className="w-full lg:hidden">
          <SegmentedSelect
            ariaLabel="Base thinking level"
            value={config?.globalDefault ?? 'off'}
            disabled={disabled}
            options={THINKING_LEVELS}
            onChange={level => update.mutate({ globalDefault: level as ThinkingLevelValue })}
          />
        </div>
        <div className="hidden lg:block">
          <Segmented
            ariaLabel="Base thinking level"
            value={config?.globalDefault ?? 'off'}
            disabled={disabled}
            options={THINKING_LEVELS}
            onChange={level => update.mutate({ globalDefault: level as ThinkingLevelValue })}
          />
        </div>
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

  const modeOptions = [{ value: USE_GLOBAL, label: 'Global' }, ...THINKING_LEVELS];

  return (
    <>
      <ThinkingError error={error} />
      {(config?.modes ?? []).map(mode => (
        <SettingsRow variant="factory" key={mode} label={`${mode[0]?.toUpperCase()}${mode.slice(1)} mode`}>
          <div className="w-full lg:hidden">
            <SegmentedSelect
              ariaLabel={`${mode} mode thinking level`}
              value={config?.modeDefaults[mode] ?? USE_GLOBAL}
              disabled={disabled}
              options={modeOptions}
              onChange={value =>
                update.mutate({
                  modeDefaults: { [mode]: value === USE_GLOBAL ? null : (value as ThinkingLevelValue) },
                })
              }
            />
          </div>
          <div className="hidden lg:block">
            <Segmented
              ariaLabel={`${mode} mode thinking level`}
              value={config?.modeDefaults[mode] ?? USE_GLOBAL}
              disabled={disabled}
              options={modeOptions}
              onChange={value =>
                update.mutate({
                  modeDefaults: { [mode]: value === USE_GLOBAL ? null : (value as ThinkingLevelValue) },
                })
              }
            />
          </div>
        </SettingsRow>
      ))}
    </>
  );
}
