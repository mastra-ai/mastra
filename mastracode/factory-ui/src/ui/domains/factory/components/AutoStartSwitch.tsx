import { Switch } from '@mastra/playground-ui/components/Switch';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { cn } from '@mastra/playground-ui/utils/cn';

import { useBoardQuery, useSaveBoardMutation } from '../../../../hooks/useBoardEditor';

/**
 * Turns starting on its own on or off and saves the board at once, as the phase's settings do: turning it off drops the
 * cards it was limited to. Shown only to someone who may edit the board.
 */
export function AutoStartSwitch({
  factoryId,
  boardId,
  phaseKey,
  label,
}: {
  factoryId: string;
  boardId: string;
  phaseKey: string;
  label: string;
}) {
  const stored = useBoardQuery(factoryId, boardId);
  const save = useSaveBoardMutation(factoryId, boardId);
  const board = stored.data?.board;
  if (!board || !stored.data?.canEdit || !board.editable) return null;
  const phase = board.phases.find(candidate => candidate.key === phaseKey);
  if (!phase?.runner) return null;
  const asked = save.isPending ? save.variables.phases.find(candidate => candidate.key === phaseKey) : undefined;
  const on = (asked ?? phase).autoStart ?? false;

  return (
    <label className="flex shrink-0 cursor-pointer items-center gap-2">
      <Txt as="span" variant="caption" tone="muted" className={cn(save.isError && 'text-destructive-foreground')}>
        {save.isError ? 'Didn’t save, try again' : 'Auto-start'}
      </Txt>
      <Switch
        aria-label={`${label}: start on its own`}
        checked={on}
        disabled={save.isPending}
        onCheckedChange={checked =>
          save.mutate({
            name: board.name,
            description: board.description,
            phases: board.phases.map(candidate =>
              candidate.key === phaseKey
                ? { ...candidate, autoStart: checked, autoStartWhen: checked ? candidate.autoStartWhen : null }
                : candidate,
            ),
            expectedRevision: board.revision ?? 0,
          })
        }
      />
    </label>
  );
}
