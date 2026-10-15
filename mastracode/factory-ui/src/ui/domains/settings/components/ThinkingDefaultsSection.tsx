import { SettingsRow } from '@mastra/playground-ui/new/settings';
import { useParams } from 'react-router';

import { useFactoryThinkingDefaultQuery, useSetFactoryThinkingDefaultMutation } from '../../../../hooks/use-thinking';
import { ThinkingLevelPicker } from './SettingsFields';

function RowError({ error }: { error: unknown }) {
  if (!error) return null;
  const message =
    (error as { status?: number }).status === 403
      ? 'Only organization admins can change the thinking level'
      : error instanceof Error
        ? error.message
        : String(error);
  return <span className="text-destructive-foreground">{message}</span>;
}

export function BaseThinkingSection() {
  const { factoryId } = useParams<{ factoryId: string }>();
  const levelQuery = useFactoryThinkingDefaultQuery(factoryId);
  const update = useSetFactoryThinkingDefaultMutation(factoryId);

  if (!factoryId) return null;

  return (
    <SettingsRow
      label="Thinking level"
      description={
        <>
          <span>Used by every session and work-item run in this Factory until it picks its own level</span>
          <RowError error={update.error ?? levelQuery.error} />
        </>
      }
    >
      <ThinkingLevelPicker
        ariaLabel="Thinking level"
        value={levelQuery.data ?? 'off'}
        disabled={levelQuery.data === undefined}
        onChange={level => update.mutateAsync(level).catch(() => {})}
      />
    </SettingsRow>
  );
}
