import { Txt } from '@mastra/playground-ui/components/Txt';

import { useThinkingConfigQuery, useUpdateThinkingMutation } from '../../../../hooks/use-thinking';
import type { ThinkingLevelValue } from '../../../../hooks/use-thinking';
import { SettingsRow } from './SettingsCard';
import { Segmented, THINKING_LEVELS } from './SettingsPanel.parts';

/** Sentinel for "no per-mode override — use the global default". */
const USE_GLOBAL = '__global__';

/**
 * Deployment-wide thinking (reasoning-effort) defaults. These apply to every
 * run that has no explicit session override — including automated Factory runs
 * (triage, board work items) nobody opens interactively. A mode row set to
 * "Global" inherits the global default.
 */
export function ThinkingDefaultsSection() {
  const configQuery = useThinkingConfigQuery();
  const update = useUpdateThinkingMutation();
  const config = configQuery.data;
  const error = update.error ?? configQuery.error;
  const disabled = !config || update.isPending;

  const modeOptions = [{ value: USE_GLOBAL, label: 'Global' }, ...THINKING_LEVELS];

  return (
    <>
      {error && (
        <Txt as="p" variant="ui-xs" className="text-notice-destructive-fg px-4 pt-3">
          {error instanceof Error ? error.message : String(error)}
        </Txt>
      )}
      <SettingsRow label="Global default" hint="Used by every run without a session or mode override">
        <Segmented
          ariaLabel="Global default thinking level"
          value={config?.globalDefault ?? 'off'}
          disabled={disabled}
          options={THINKING_LEVELS}
          onChange={level => update.mutate({ globalDefault: level as ThinkingLevelValue })}
        />
      </SettingsRow>
      {(config?.modes ?? []).map(mode => (
        <SettingsRow key={mode} label={`${mode[0]?.toUpperCase()}${mode.slice(1)} mode`}>
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
        </SettingsRow>
      ))}
    </>
  );
}
