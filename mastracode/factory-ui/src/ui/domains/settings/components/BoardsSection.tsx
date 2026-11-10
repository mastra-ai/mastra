import { DEFAULT_BOARD_ID } from '@mastra/factory/boards/default-board';
import { AlertDialog } from '@mastra/playground-ui/components/AlertDialog';
import { Button } from '@mastra/playground-ui/components/Button';
import { Field, FieldDescription, FieldError, FieldLabel } from '@mastra/playground-ui/components/Field';
import { Input } from '@mastra/playground-ui/components/Input';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@mastra/playground-ui/components/Select';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useId, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router';
import type { Location } from 'react-router';

import { useApiConfig } from '../../../../api/config';
import type { InstalledBoardInfo, StoredBoardInfo } from '../../../../api/types';
import { useBoardCatalog } from '../../../../hooks/useBoardCatalog';
import {
  storedBoardQueryOptions,
  useBoardQuery,
  useCreateBoardMutation,
  useDeleteBoardMutation,
  useResetBoardMutation,
  useSaveBoardMutation,
} from '../../../../hooks/useBoardEditor';
import type { BoardRequestError } from '../../../../hooks/useBoardEditor';
import { useFactorySkillsQuery } from '../../../../hooks/useFactorySkills';
import { useCanEditBoards } from '../../../../hooks/useIntakeRoutes';
import { boardPath, orderedBoards } from '../../factory/boardCatalog';
import { draftOf, keyFromName, keyProblem, starterBoard } from '../services/boardDraft';
import type { BoardDraft } from '../services/boardDraft';
import { settingsSectionPath } from '../settingsSections';
import { BoardDefinitionFields, draftIsComplete, useRuleProblems } from './BoardDefinitionFields';
import { SettingsSubsection } from './SettingsSubsection';

const STARTER = '__starter__';

function errorText(error: BoardRequestError): string {
  return error.conflicts.length > 0 ? error.conflicts.join('\n') : error.message;
}

function useSkillNames(factoryId: string): string[] {
  return (useFactorySkillsQuery(factoryId).data?.skills ?? []).map(skill => skill.name);
}

/** How cards get to a board other than Work: Factory files them by the project's intake routes. */
function IntakeNote({ factoryId }: { factoryId: string }) {
  return (
    <Notice variant="info">
      {/* One element: the notice stacks its children. */}
      <span>
        New cards land on the Work board unless an intake route sends them to this one. Add a route in{' '}
        <Link to={settingsSectionPath(factoryId, 'intake')} className="underline">
          Work Intake
        </Link>
        .
      </span>
    </Notice>
  );
}

function StaleNotice({ onReload }: { onReload: () => void }) {
  return (
    <Notice
      variant="warning"
      title="Someone else changed this board"
      action={
        <Button size="sm" onClick={onReload}>
          Reload
        </Button>
      }
    >
      It changed since you opened it, so your edit was not saved. Reload to see the latest version, then edit it again.
    </Notice>
  );
}

function BoardEditor({
  factoryId,
  board,
  canEdit,
  onReload,
  onDeleted,
}: {
  factoryId: string;
  board: StoredBoardInfo;
  canEdit: boolean;
  onReload: () => void;
  onDeleted: () => void;
}) {
  const [draft, setDraft] = useState<BoardDraft>(() => draftOf(board));
  const rules = useRuleProblems();
  const save = useSaveBoardMutation(factoryId, board.key);
  const reset = useResetBoardMutation(factoryId, board.key);
  const remove = useDeleteBoardMutation(factoryId, board.key, onDeleted);
  const skills = useSkillNames(factoryId);
  const readOnly = !canEdit || !board.editable;
  const changed = JSON.stringify(draft) !== JSON.stringify(draftOf(board));
  const error = save.error ?? reset.error ?? remove.error;
  const stale = error?.code === 'revision_mismatch';
  const pending = save.isPending || reset.isPending || remove.isPending;
  // Only the read-only Review board has no revision, and it can't be saved, reset or deleted.
  const revision = board.revision ?? 0;
  const clearErrors = () => {
    save.reset();
    reset.reset();
    remove.reset();
  };

  return (
    <div className="flex flex-col gap-4">
      {readOnly && (
        <Notice variant="info">
          {board.editable
            ? 'Only organization admins can edit boards.'
            : 'This board is defined in code and is read-only.'}
        </Notice>
      )}
      {board.problems.map(problem => (
        <Notice key={problem} variant="warning">
          {problem}
        </Notice>
      ))}
      {board.key !== DEFAULT_BOARD_ID && <IntakeNote factoryId={factoryId} />}
      <BoardDefinitionFields
        draft={draft}
        codeBehaviour={board.codeBehaviour}
        skills={skills}
        disabled={readOnly || pending}
        onChange={setDraft}
        onRuleProblem={rules.report}
      >
        <div className="flex flex-col gap-1 pt-6">
          <Txt as="span" font="mono" variant="caption" tone="muted">
            {board.key}
          </Txt>
          <Txt as="span" variant="caption" tone="muted" className="tabular-nums">
            Revision {board.revision}
          </Txt>
        </div>
      </BoardDefinitionFields>
      {stale && <StaleNotice onReload={onReload} />}
      {error && !stale && (
        <Notice
          variant="destructive"
          role="alert"
          title={remove.error ? 'The board was not deleted' : 'The board was not saved'}
        >
          <span className="whitespace-pre-wrap">{errorText(error)}</span>
        </Notice>
      )}
      {!readOnly && (
        <div className="flex flex-wrap justify-end gap-2">
          {board.source !== 'builtin' && (
            <AlertDialog>
              <AlertDialog.Trigger
                render={
                  <Button variant="destructive-ghost" disabled={pending}>
                    Delete board
                  </Button>
                }
              />
              <AlertDialog.Content>
                <AlertDialog.Header>
                  <AlertDialog.Title>Delete {board.name}?</AlertDialog.Title>
                  <AlertDialog.Description>
                    The board and its phases are removed from this Factory. A board that still has cards cannot be
                    deleted. This cannot be undone.
                  </AlertDialog.Description>
                </AlertDialog.Header>
                <AlertDialog.Footer>
                  <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
                  <AlertDialog.Action
                    onClick={() => {
                      clearErrors();
                      remove.mutate(revision);
                    }}
                  >
                    Delete board
                  </AlertDialog.Action>
                </AlertDialog.Footer>
              </AlertDialog.Content>
            </AlertDialog>
          )}
          {board.source !== 'stored' && (
            <Button
              disabled={pending}
              onClick={() => {
                clearErrors();
                reset.mutate(revision);
              }}
            >
              Reset to default
            </Button>
          )}
          <Button
            variant="primary"
            disabled={!changed || rules.blocked || pending || !draftIsComplete(draft)}
            onClick={() => {
              clearErrors();
              save.mutate({ ...draft, name: draft.name.trim(), expectedRevision: revision });
            }}
          >
            Save
          </Button>
        </div>
      )}
    </div>
  );
}

function NewBoardForm({
  factoryId,
  boards,
  onCancel,
}: {
  factoryId: string;
  boards: InstalledBoardInfo[];
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<BoardDraft>(starterBoard);
  const [typedKey, setTypedKey] = useState<string | undefined>(undefined);
  const [source, setSource] = useState(STARTER);
  const [copyError, setCopyError] = useState<string | undefined>(undefined);
  const [copying, setCopying] = useState(false);
  const rules = useRuleProblems();
  const create = useCreateBoardMutation(factoryId);
  const skills = useSkillNames(factoryId);
  const { baseUrl } = useApiConfig();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const id = useId();

  // The key follows the name until it is typed by hand.
  const key = typedKey ?? keyFromName(draft.name);
  const untouched = typedKey === undefined && draft.name.trim() === '';
  // A create the server answers with a conflict is about the key, whatever holds it: shown on the key field.
  const refusedKey = create.error?.status === 409 ? create.error.message : undefined;
  const invalidKey = untouched
    ? undefined
    : keyProblem(
        key,
        boards.map(board => board.id),
      );
  const keyError = invalidKey ?? refusedKey;
  const pending = create.isPending || copying;
  const sourceName = (value: string) => boards.find(board => board.id === value)?.title ?? 'Backlog, Doing, Done';

  const startFrom = async (value: string) => {
    setSource(value);
    setCopyError(undefined);
    rules.clear();
    if (value === STARTER) {
      setDraft(current => ({ ...starterBoard(), name: current.name }));
      return;
    }
    setCopying(true);
    try {
      const { board } = await queryClient.fetchQuery(storedBoardQueryOptions(baseUrl, factoryId, value));
      setDraft(current => ({ ...draftOf(board), name: current.name }));
    } catch (error) {
      setCopyError(error instanceof Error ? error.message : 'The board could not be read.');
    } finally {
      setCopying(false);
    }
  };

  return (
    // Not a form: the phase editor's own buttons would submit it.
    <section className="flex flex-col gap-4" aria-label="New board">
      <Field>
        <FieldLabel htmlFor={`${id}-source`}>Start from</FieldLabel>
        <Select value={source} disabled={pending} onValueChange={value => void startFrom(String(value))}>
          <SelectTrigger id={`${id}-source`} size="sm" aria-label="Start from">
            {sourceName(source)}
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={STARTER}>{sourceName(STARTER)}</SelectItem>
            {boards.map(board => (
              <SelectItem key={board.id} value={board.id}>
                Copy of {board.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <FieldDescription>The phases the board starts with. Change them below before you create it.</FieldDescription>
      </Field>
      {copyError && (
        <Notice variant="destructive" role="alert" title="The board was not copied">
          {copyError}
        </Notice>
      )}
      <BoardDefinitionFields
        draft={draft}
        skills={skills}
        disabled={pending}
        onChange={update => {
          if (create.error) create.reset();
          setDraft(update);
        }}
        onRuleProblem={rules.report}
      >
        <Field className="min-w-60 flex-1" invalid={keyError !== undefined}>
          <FieldLabel htmlFor={`${id}-key`}>Board key</FieldLabel>
          <Input
            id={`${id}-key`}
            value={key}
            disabled={pending}
            onChange={event => {
              if (create.error) create.reset();
              setTypedKey(event.target.value);
            }}
          />
          {keyError ? (
            <FieldError>{keyError}</FieldError>
          ) : (
            <FieldDescription>Names the board in links and the API. Cannot be changed later.</FieldDescription>
          )}
        </Field>
      </BoardDefinitionFields>
      <IntakeNote factoryId={factoryId} />
      {create.error && !refusedKey && (
        <Notice variant="destructive" role="alert" title="The board was not created">
          <span className="whitespace-pre-wrap">{errorText(create.error)}</span>
        </Notice>
      )}
      <div className="flex justify-end gap-2">
        <Button disabled={create.isPending} onClick={onCancel}>
          Cancel
        </Button>
        <Button
          variant="primary"
          disabled={pending || rules.blocked || !draftIsComplete(draft) || untouched || invalidKey !== undefined}
          onClick={() =>
            create.mutate(
              { ...draft, key, name: draft.name.trim() },
              { onSuccess: ({ board }) => void navigate(boardPath(factoryId, board.key)) },
            )
          }
        >
          Create board
        </Button>
      </div>
    </section>
  );
}

/**
 * The project's boards as stored. Organization admins create a board, edit any of them — its name,
 * description and phases — delete the ones the project or the app added, and reset the built-in
 * and app boards to their code definition. Everyone else sees them read-only.
 */
export function BoardsSection({ factoryId }: { factoryId?: string }) {
  const [params, setParams] = useSearchParams();
  const catalog = useBoardCatalog(factoryId);
  const boards = orderedBoards(catalog.data ?? []);
  // The Work board unless the project has none: then its first board, if it has any.
  const first = (without?: string) =>
    boards.find(board => board.id === DEFAULT_BOARD_ID && board.id !== without)?.id ??
    boards.find(board => board.id !== without)?.id;
  const picked = params.get('board');
  // A project can have no boards at all: there is none to read then.
  const none = picked === null && catalog.data?.length === 0;
  const selected = picked ?? first() ?? DEFAULT_BOARD_ID;
  const canEdit = useCanEditBoards(factoryId);
  // A link to the new-board form shows the Work board to someone who may not create one.
  const creating = canEdit && params.has('new');
  // Which board to open with is not known until the boards are.
  const waiting = creating || none || (picked === null && catalog.isPending);
  const query = useBoardQuery(waiting ? undefined : factoryId, selected);
  const data = query.data;
  const id = useId();
  const location = useLocation();
  // Closing Settings returns to the page it was opened from, which the location's state carries.
  const show = (target: { board?: string; new?: true }, state: unknown = location.state) =>
    setParams(target.new ? { new: '1' } : target.board ? { board: target.board } : {}, { replace: true, state });
  const showAfterDelete = (deleted: string) => {
    const from = (location.state as { from?: Location } | null)?.from;
    // The page Settings was opened from is gone with the board: return to a board that is left
    // instead, or to the Factory when that was its last.
    const gone = factoryId !== undefined && from?.pathname === boardPath(factoryId, deleted);
    const next = first(deleted);
    const pathname = next === undefined ? `/factories/${factoryId}` : boardPath(factoryId ?? '', next);
    show(
      next === undefined || next === DEFAULT_BOARD_ID ? {} : { board: next },
      gone ? { from: { ...from, pathname, search: '', hash: '' } } : location.state,
    );
  };

  return (
    <SettingsSubsection
      scope="factory"
      title="Boards"
      description="The boards of this Factory and how cards move through each: its phases, when a phase starts on its own, what its agent is told, when its plan is approved without a person, and where cards go next. Changes apply to this Factory only."
      action={
        factoryId && canEdit && !creating ? (
          <Button size="sm" onClick={() => show({ new: true })}>
            <Plus />
            New board
          </Button>
        ) : undefined
      }
    >
      {!factoryId && <Notice variant="info">Open a Factory to edit its boards.</Notice>}
      {factoryId && creating && <NewBoardForm factoryId={factoryId} boards={boards} onCancel={() => show({})} />}
      {factoryId && !creating && (
        <>
          {boards.length > 1 && (
            <Field>
              <FieldLabel htmlFor={`${id}-board`}>Board</FieldLabel>
              <Select value={selected} onValueChange={value => show({ board: String(value) })}>
                <SelectTrigger id={`${id}-board`} size="sm" aria-label="Board">
                  {boards.find(board => board.id === selected)?.title ?? selected}
                </SelectTrigger>
                <SelectContent>
                  {boards.map(board => (
                    <SelectItem key={board.id} value={board.id}>
                      {board.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}
          {none && <Notice variant="info">No boards installed.</Notice>}
          {!none && query.isPending && (
            <Txt tone="muted" as="p" variant="caption" role="status">
              Loading the board…
            </Txt>
          )}
          {query.error && <Notice variant="destructive">{query.error.message}</Notice>}
          {data && (
            <BoardEditor
              // Another board, or a new revision (saved, reset or reloaded), starts a fresh draft.
              key={`${data.board.key}:${data.board.revision ?? 'code'}`}
              factoryId={factoryId}
              board={data.board}
              canEdit={data.canEdit ?? false}
              onReload={() => void query.refetch()}
              onDeleted={() => showAfterDelete(data.board.key)}
            />
          )}
        </>
      )}
    </SettingsSubsection>
  );
}
