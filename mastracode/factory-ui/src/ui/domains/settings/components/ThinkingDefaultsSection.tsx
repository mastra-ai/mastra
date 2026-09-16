import { SettingsRow } from '@mastra/playground-ui/new/settings';

import { useThinkingConfigQuery, useUpdateThinkingMutation } from '../../../../hooks/use-thinking';
import { ThinkingLevelPicker } from './SettingsFields';

function useThinkingSection() {
  const configQuery = useThinkingConfigQuery();
  const update = useUpdateThinkingMutation();
  const config = configQuery.data;
  const readOnly = !!config && !config.editable;
  return { config, update, loadError: configQuery.error, disabled: !config || readOnly, readOnly };
}

const READ_ONLY_REASON = 'Read-only here — these defaults are shared by everyone on this deployment';

function RowError({ error }: { error: unknown }) {
  if (!error) return null;
  return <span className="text-notice-destructive-fg">{error instanceof Error ? error.message : String(error)}</span>;
}

export function BaseThinkingSection() {
  const { config, update, loadError, disabled, readOnly } = useThinkingSection();
  const writeError = update.variables?.globalDefault !== undefined ? update.error : null;

  return (
    <SettingsRow
      label="Base thinking level"
      description={
        <>
          <span>Used by every run without a session or mode override</span>
          {readOnly && <span className="text-neutral2">{READ_ONLY_REASON}</span>}
          <RowError error={writeError ?? loadError} />
        </>
      }
    >
      <ThinkingLevelPicker
        ariaLabel="Base thinking level"
        value={config?.globalDefault ?? 'off'}
        disabled={disabled}
        onChange={level => (level ? update.mutateAsync({ globalDefault: level }).catch(() => {}) : undefined)}
      />
    </SettingsRow>
  );
}

export function ModeThinkingDefaultsSection() {
  const { config, update, disabled } = useThinkingSection();
  const writtenMode = Object.keys(update.variables?.modeDefaults ?? {})[0];

  return (
    <>
      {(config?.modes ?? []).map(mode => (
        <SettingsRow
          key={mode}
          label={`${mode[0]?.toUpperCase()}${mode.slice(1)} mode`}
          description={mode === writtenMode ? <RowError error={update.error} /> : undefined}
        >
          <ThinkingLevelPicker
            ariaLabel={`${mode} mode thinking level`}
            value={config?.modeDefaults[mode]}
            inherited={config?.globalDefault ?? 'off'}
            disabled={disabled}
            onChange={level => update.mutateAsync({ modeDefaults: { [mode]: level ?? null } }).catch(() => {})}
          />
        </SettingsRow>
      ))}
    </>
  );
}
