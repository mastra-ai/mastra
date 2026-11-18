import type { InstalledPhaseInfo } from '../../../../api/types';
import { useBoardQuery, useSaveBoardMutation } from '../../../../hooks/useBoardEditor';
import { withAutoStart } from '../../boardConfig/boardDraft';
import { StartsToggle } from '../../boardConfig/components/StartsToggle';

/**
 * How a phase starts, switched from the board itself: the change saves the board at once. When someone saved the board
 * first, it reloads, so trying again saves against their version.
 */
export function AutoStartSwitch({
  factoryId,
  boardId,
  phase,
  label,
}: {
  factoryId: string;
  boardId: string;
  phase: InstalledPhaseInfo;
  label: string;
}) {
  const stored = useBoardQuery(factoryId, boardId);
  const save = useSaveBoardMutation(factoryId, boardId);
  const board = stored.data?.board;
  const editable = board && stored.data?.canEdit && board.editable;
  const asked = save.isPending ? save.variables.phases.find(candidate => candidate.key === phase.id) : undefined;
  const saved = board?.phases.find(candidate => candidate.key === phase.id);

  return (
    <StartsToggle
      label={label}
      autoStart={(asked ?? saved ?? phase).autoStart ?? false}
      autoStartWhen={(saved ?? phase).autoStartWhen}
      pending={save.isPending}
      failed={save.isError}
      onChange={
        editable
          ? on =>
              save.mutate(
                {
                  name: board.name,
                  description: board.description,
                  phases: board.phases.map(candidate =>
                    candidate.key === phase.id ? withAutoStart(candidate, on) : candidate,
                  ),
                  expectedRevision: board.revision ?? 0,
                },
                {
                  onError: error => {
                    if (error.code === 'revision_mismatch') void stored.refetch();
                  },
                },
              )
          : undefined
      }
    />
  );
}
