import { Button } from '@mastra/playground-ui/components/Button';
import {
  Dialog,
  DialogAction,
  DialogBody,
  DialogCancel,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@mastra/playground-ui/components/Dialog';
import { Field, FieldDescription, FieldError, FieldLabel } from '@mastra/playground-ui/components/Field';
import { Input } from '@mastra/playground-ui/components/Input';
import { Plus } from 'lucide-react';
import { useId, useState } from 'react';
import { useNavigate } from 'react-router';

import type { StoredBoardInfo } from '../../../../api/types';
import { useOverlays } from '../../../lib/overlays';
import { useBoardDraft } from '../BoardDraftProvider';
import { boardConfigPath } from '../boardConfigPaths';
import { keyFromName, keyProblem } from '../boardDraft';

/**
 * Adds a phase to the end of the board's draft and opens its page. New phases are resting; their kind changes on
 * their page. The key is fixed once added: cards and other phases refer to it.
 */
export function AddPhaseButton({
  factoryId,
  boardId,
  board,
  disabled,
}: {
  factoryId: string;
  boardId: string;
  board: StoredBoardInfo;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        size="sm"
        variant="ghost"
        icon={<Plus />}
        className="justify-start"
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        Add phase
      </Button>
      {open && <AddPhaseDialog factoryId={factoryId} boardId={boardId} board={board} onClose={() => setOpen(false)} />}
    </>
  );
}

function AddPhaseDialog({
  factoryId,
  boardId,
  board,
  onClose,
}: {
  factoryId: string;
  boardId: string;
  board: StoredBoardInfo;
  onClose: () => void;
}) {
  const { draft, setDraft } = useBoardDraft(factoryId, boardId, board);
  const [name, setName] = useState('');
  const [typedKey, setTypedKey] = useState<string>();
  const navigate = useNavigate();
  const overlays = useOverlays();
  const id = useId();

  // The key follows the name until it is typed by hand.
  const key = typedKey ?? keyFromName(name);
  const problem =
    typedKey === undefined && name.trim() === ''
      ? undefined
      : keyProblem(
          key,
          draft.phases.map(phase => phase.key),
        );
  const ready = name.trim() !== '' && problem === undefined;

  const add = () => {
    if (!ready) return;
    setDraft(current => ({
      ...current,
      phases: [...current.phases, { key, name: name.trim(), kind: 'resting', nextPhases: [] }],
    }));
    onClose();
    overlays.close('sidebar');
    void navigate(boardConfigPath(factoryId, boardId, key));
  };

  return (
    <Dialog open onOpenChange={next => !next && onClose()}>
      <DialogContent>
        <form
          onSubmit={event => {
            event.preventDefault();
            add();
          }}
        >
          <DialogHeader>
            <DialogTitle>Add phase</DialogTitle>
          </DialogHeader>
          <DialogBody className="flex flex-col gap-4">
            <Field>
              <FieldLabel htmlFor={`${id}-name`}>Phase name</FieldLabel>
              <Input id={`${id}-name`} value={name} autoFocus onChange={event => setName(event.target.value)} />
            </Field>
            <Field invalid={problem !== undefined}>
              <FieldLabel htmlFor={`${id}-key`}>Phase key</FieldLabel>
              <Input id={`${id}-key`} value={key} onChange={event => setTypedKey(event.target.value)} />
              {problem ? (
                <FieldError>{problem}</FieldError>
              ) : (
                <FieldDescription>Cards and other phases refer to it. Cannot be changed later.</FieldDescription>
              )}
            </Field>
          </DialogBody>
          <DialogFooter>
            <DialogCancel>Cancel</DialogCancel>
            <DialogAction type="submit" disabled={!ready}>
              Add phase
            </DialogAction>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
