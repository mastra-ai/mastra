import { SettingsRow } from '@mastra/playground-ui/components/SettingsRow';

import { useThinkingConfigQuery, useUpdateThinkingMutation } from '../../../../hooks/use-thinking';
import { ThinkingLevelPicker } from './SettingsFields';

function useThinkingSection() {
  const configQuery = useThinkingConfigQuery();
  const update = useUpdateThinkingMutation();
  const config = configQuery.data;
  const readOnly = !!config && !config.editable;
  return { config, update, loadError: configQuery.error, disabled: !config || readOnly, readOnly };
}

/** These defaults live in one deployment-wide settings file, so a shared deployment refuses writes. */
const READ_ONLY_REASON = 'Read-only here — these defaults are shared by everyone on this deployment';

/** A write that failed belongs under the row that asked for it, not above the section. */
function RowError({ error }: { error: unknown }) {
  if (!error) return null;
  return <span className="text-notice-destructive-fg">{error instanceof Error ? error.message : String(error)}</span>;
}

/**
 * The deployment-wide base thinking (reasoning-effort) level. Applied to every
 * run without a session or mode override — including automated Factory runs
 * (triage, board work items) nobody opens interactively.
 */
export function BaseThinkingSection() {
  const { config, update, loadError, disabled, readOnly } = useThinkingSection();
  const writeError = update.variables?.globalDefault !== undefined ? update.error : null;

  return (
    <SettingsRow
      variant="factory"
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

/**
 * Per-mode overrides of the base level, rendered directly under it so "Follows
 * base" points at a row the reader can see. A mode without its own level shows
 * the base level it inherits rather than hiding it.
 */
export function ModeThinkingDefaultsSection() {
  const { config, update, disabled } = useThinkingSection();
  const writtenMode = Object.keys(update.variables?.modeDefaults ?? {})[0];

  return (
    <>
      {(config?.modes ?? []).map(mode => (
        <SettingsRow
          variant="factory"
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
