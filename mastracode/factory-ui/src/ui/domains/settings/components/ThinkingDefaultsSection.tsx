import { SettingsRow } from '@mastra/playground-ui/new/settings';

import { useThinkingConfigQuery, useUpdateThinkingMutation } from '../../../../hooks/use-thinking';
import { ThinkingLevelPicker } from './SettingsFields';

const READ_ONLY_REASON = 'Read-only here — these defaults are shared by everyone on this deployment';

function RowError({ error }: { error: unknown }) {
  if (!error) return null;
  return <span className="text-destructive-foreground">{error instanceof Error ? error.message : String(error)}</span>;
}

export function BaseThinkingSection() {
  const configQuery = useThinkingConfigQuery();
  const update = useUpdateThinkingMutation();
  const config = configQuery.data;
  const readOnly = !!config && !config.editable;

  return (
    <SettingsRow
      label="Base thinking level"
      description={
        <>
          <span>Used by every run without its own level</span>
          {readOnly && <span className="text-placeholder">{READ_ONLY_REASON}</span>}
          <RowError error={update.error ?? configQuery.error} />
        </>
      }
    >
      <ThinkingLevelPicker
        ariaLabel="Base thinking level"
        value={config?.globalDefault ?? 'off'}
        disabled={!config || readOnly}
        onChange={level => update.mutateAsync({ globalDefault: level }).catch(() => {})}
      />
    </SettingsRow>
  );
}
