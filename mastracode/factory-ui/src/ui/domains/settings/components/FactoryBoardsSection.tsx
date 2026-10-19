import { Badge } from '@mastra/playground-ui/components/Badge';
import { Button } from '@mastra/playground-ui/components/Button';
import {
  Dialog,
  DialogAction,
  DialogBody,
  DialogCancel,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@mastra/playground-ui/components/Dialog';
import { Input } from '@mastra/playground-ui/components/Input';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@mastra/playground-ui/components/Select';
import { Textarea } from '@mastra/playground-ui/components/Textarea';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { SettingsContainer } from '@mastra/playground-ui/new/settings';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';

import type { InstalledBoardInfo, InstalledPhaseInfo, LibrarySkillInfo, PhaseSkillInfo } from '../../../../api/types';
import { useBoardCatalog } from '../../../../hooks/useBoardCatalog';
import type { BoardInput, BoardPhaseInput } from '../../../../hooks/usePhaseSkills';
import {
  useDeleteBoardMutation,
  useDeleteLibrarySkillMutation,
  usePhaseSkillsQuery,
  useSaveBoardMutation,
  useSaveLibrarySkillMutation,
  useSetPhaseSkillMutation,
  useSkillLibraryQuery,
} from '../../../../hooks/usePhaseSkills';
import { orderedBoards } from '../../factory/boardCatalog';
import { SettingsSubsection } from './SettingsSubsection';

const DEFAULT_VALUE = '__default__';
const PROMPT_VALUE = '__prompt__';
const SKILL_PREFIX = 'skill:';

function errorText(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function SkillDialog({
  factoryId,
  skill,
  onClose,
}: {
  factoryId: string;
  skill?: LibrarySkillInfo;
  onClose: () => void;
}) {
  const mutation = useSaveLibrarySkillMutation();
  const [name, setName] = useState(skill?.name ?? '');
  const [description, setDescription] = useState(skill?.description ?? '');
  const [content, setContent] = useState(skill?.content ?? '');
  const ready = name.trim() && description.trim() && content.trim();

  const save = async () => {
    if (!ready || mutation.isPending) return;
    try {
      await mutation.mutateAsync({
        factoryId,
        existing: skill?.name,
        skill: { name: name.trim(), description: description.trim(), content },
      });
      onClose();
    } catch {}
  };

  return (
    <Dialog open onOpenChange={open => !open && !mutation.isPending && onClose()} pending={mutation.isPending}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{skill ? `Edit ${skill.name}` : 'New skill'}</DialogTitle>
          <DialogDescription>Skills in this library can run in any board phase of this Factory.</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <Input
            autoFocus={!skill}
            aria-label="Skill name"
            placeholder="my-skill"
            value={name}
            disabled={Boolean(skill) || mutation.isPending}
            onChange={event => setName(event.target.value)}
          />
          <Input
            aria-label="Skill description"
            placeholder="What the skill does"
            value={description}
            disabled={mutation.isPending}
            onChange={event => setDescription(event.target.value)}
          />
          <Textarea
            aria-label="Skill instructions"
            placeholder="Instructions the agent follows"
            rows={10}
            value={content}
            disabled={mutation.isPending}
            onChange={event => setContent(event.target.value)}
          />
          {mutation.error && (
            <Txt as="p" variant="caption" className="text-destructive-foreground" role="alert">
              {errorText(mutation.error, 'Failed to save skill')}
            </Txt>
          )}
        </DialogBody>
        <DialogFooter>
          <DialogCancel>Cancel</DialogCancel>
          <DialogAction disabled={!ready} onConfirm={() => void save()}>
            {mutation.isPending ? 'Saving…' : 'Save'}
          </DialogAction>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PromptDialog({
  title,
  initial,
  pending,
  error,
  onSave,
  onClose,
}: {
  title: string;
  initial: string;
  pending: boolean;
  error: unknown;
  onSave: (prompt: string) => void;
  onClose: () => void;
}) {
  const [prompt, setPrompt] = useState(initial);
  return (
    <Dialog open onOpenChange={open => !open && !pending && onClose()} pending={pending}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Prompt for {title}</DialogTitle>
          <DialogDescription>
            Sent to the agent when a card enters this phase, followed by the card's details.
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <Textarea
            autoFocus
            aria-label={`Prompt for ${title}`}
            rows={8}
            value={prompt}
            disabled={pending}
            onChange={event => setPrompt(event.target.value)}
          />
          {Boolean(error) && (
            <Txt as="p" variant="caption" className="text-destructive-foreground" role="alert">
              {errorText(error, 'Failed to save prompt')}
            </Txt>
          )}
        </DialogBody>
        <DialogFooter>
          <DialogCancel>Cancel</DialogCancel>
          <DialogAction disabled={!prompt.trim()} onConfirm={() => onSave(prompt.trim())}>
            {pending ? 'Saving…' : 'Save'}
          </DialogAction>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ConfirmDeleteDialog({
  title,
  description,
  pending,
  onConfirm,
  onClose,
}: {
  title: string;
  description: string;
  pending: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog open onOpenChange={open => !open && !pending && onClose()} pending={pending}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogCancel>Cancel</DialogCancel>
          <DialogAction disabled={pending} onConfirm={onConfirm}>
            Delete
          </DialogAction>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SkillLibrary({ factoryId, skills }: { factoryId: string; skills: LibrarySkillInfo[] }) {
  const [editing, setEditing] = useState<LibrarySkillInfo | 'new'>();
  const [deleting, setDeleting] = useState<string>();
  const remove = useDeleteLibrarySkillMutation();

  return (
    <section aria-label="Skill library" className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <Txt tone="ink" as="h4" variant="body" className="m-0">
          Skill library
        </Txt>
        <Button size="sm" onClick={() => setEditing('new')}>
          <Plus /> New skill
        </Button>
      </div>
      <SettingsContainer>
        {skills.length === 0 ? (
          <Txt tone="muted" as="p" variant="caption" className="px-4 py-3">
            No skills yet. Create one to run it in a board phase.
          </Txt>
        ) : (
          <ul className="m-0 flex list-none flex-col p-0">
            {skills.map(skill => (
              <li key={skill.name} className="flex items-center justify-between gap-4 px-4 py-3">
                <div className="flex min-w-0 flex-col">
                  <Txt tone="ink" as="span" variant="body">
                    {skill.name}
                  </Txt>
                  <Txt tone="muted" as="span" variant="caption" className="truncate">
                    {skill.description}
                  </Txt>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="icon-sm"
                    tooltip="Edit skill"
                    aria-label={`Edit ${skill.name}`}
                    onClick={() => setEditing(skill)}
                  >
                    <Pencil />
                  </Button>
                  <Button
                    size="icon-sm"
                    tooltip="Delete skill"
                    aria-label={`Delete ${skill.name}`}
                    disabled={remove.isPending}
                    onClick={() => setDeleting(skill.name)}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </SettingsContainer>
      {remove.error && (
        <Txt as="p" variant="caption" className="text-destructive-foreground">
          {errorText(remove.error, 'Failed to delete skill')}
        </Txt>
      )}
      {deleting && (
        <ConfirmDeleteDialog
          title={`Delete ${deleting}?`}
          description="This removes the skill's instructions and clears every phase that runs it. This can't be undone."
          pending={remove.isPending}
          onConfirm={() => remove.mutate({ factoryId, name: deleting }, { onSettled: () => setDeleting(undefined) })}
          onClose={() => setDeleting(undefined)}
        />
      )}
      {editing && (
        <SkillDialog
          factoryId={factoryId}
          skill={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(undefined)}
        />
      )}
    </section>
  );
}

const KINDS = ['resting', 'working', 'terminal'] as const;

const STARTER_BOARD: BoardInput = {
  title: '',
  initialPhase: 'backlog',
  phases: [
    { id: 'backlog', title: 'Backlog', kind: 'resting', next: ['working'] },
    { id: 'working', title: 'Working', kind: 'working', role: 'work', next: ['done'] },
    { id: 'done', title: 'Done', kind: 'terminal', next: [] },
  ],
};

function boardInput(board: InstalledBoardInfo): BoardInput {
  return {
    title: board.title,
    initialPhase: board.initialPhase,
    phases: board.phases.map(phase => ({
      id: phase.id,
      title: phase.title,
      kind: phase.kind,
      ...(phase.role ? { role: phase.role } : {}),
      next: [...new Set(phase.transitions.map(transition => transition.to))],
    })),
  };
}

function phaseIdFor(title: string, taken: Set<string>) {
  const base =
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'phase';
  let id = base;
  for (let n = 2; taken.has(id); n++) id = `${base}-${n}`;
  return id;
}

function BoardDialog({
  factoryId,
  board,
  onClose,
}: {
  factoryId: string;
  board?: InstalledBoardInfo;
  onClose: () => void;
}) {
  const mutation = useSaveBoardMutation();
  const [draft, setDraft] = useState<BoardInput>(() => (board ? boardInput(board) : STARTER_BOARD));
  const ready = draft.title.trim() && draft.phases.every(phase => phase.title.trim());

  const updatePhase = (index: number, patch: Partial<BoardPhaseInput>) =>
    setDraft(current => ({
      ...current,
      phases: current.phases.map((phase, i) => (i === index ? { ...phase, ...patch } : phase)),
    }));
  const addPhase = () =>
    setDraft(current => {
      const id = phaseIdFor('New phase', new Set(current.phases.map(phase => phase.id)));
      return { ...current, phases: [...current.phases, { id, title: 'New phase', kind: 'resting', next: [] }] };
    });
  const removePhase = (index: number) =>
    setDraft(current => {
      const removed = current.phases[index]!.id;
      const phases = current.phases
        .filter((_, i) => i !== index)
        .map(phase => ({ ...phase, next: phase.next.filter(to => to !== removed) }));
      return {
        ...current,
        phases,
        initialPhase: current.initialPhase === removed ? (phases[0]?.id ?? '') : current.initialPhase,
      };
    });

  const save = async () => {
    if (!ready || mutation.isPending) return;
    const phases = draft.phases.map(phase => {
      const { role, ...rest } = phase;
      if (phase.kind === 'terminal') return { ...rest, next: [] };
      return phase.kind === 'working' ? { ...rest, role: role?.trim() || 'work' } : rest;
    });
    try {
      await mutation.mutateAsync({
        factoryId,
        boardId: board?.id,
        board: { ...draft, title: draft.title.trim(), phases },
      });
      onClose();
    } catch {}
  };

  return (
    <Dialog open onOpenChange={open => !open && !mutation.isPending && onClose()} pending={mutation.isPending}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{board ? `Edit ${board.title}` : 'New board'}</DialogTitle>
          <DialogDescription>
            Cards start in the first resting phase you pick. Working phases start an agent in their role.
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <Input
            autoFocus
            aria-label="Board title"
            placeholder="Board title"
            value={draft.title}
            disabled={mutation.isPending}
            onChange={event => setDraft(current => ({ ...current, title: event.target.value }))}
          />
          <Select value={draft.initialPhase} onValueChange={initialPhase => setDraft(c => ({ ...c, initialPhase }))}>
            <SelectTrigger size="sm" aria-label="Starting phase">
              Starts in: {draft.phases.find(phase => phase.id === draft.initialPhase)?.title ?? '—'}
            </SelectTrigger>
            <SelectContent>
              {draft.phases.map(phase => (
                <SelectItem key={phase.id} value={phase.id}>
                  {phase.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            {draft.phases.map((phase, index) => (
              <li key={phase.id} className="border-border1 flex flex-col gap-2 rounded-md border p-3">
                <div className="flex items-center gap-2">
                  <Input
                    aria-label={`Phase ${index + 1} title`}
                    value={phase.title}
                    disabled={mutation.isPending}
                    onChange={event => updatePhase(index, { title: event.target.value })}
                  />
                  <Select
                    value={phase.kind}
                    onValueChange={kind => updatePhase(index, { kind: kind as BoardPhaseInput['kind'] })}
                  >
                    <SelectTrigger size="sm" aria-label={`Phase ${index + 1} kind`} className="w-32">
                      {phase.kind}
                    </SelectTrigger>
                    <SelectContent>
                      {KINDS.map(kind => (
                        <SelectItem key={kind} value={kind}>
                          {kind}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {phase.kind === 'working' && (
                    <Input
                      aria-label={`Phase ${index + 1} role`}
                      placeholder="role"
                      className="w-32"
                      value={phase.role ?? ''}
                      disabled={mutation.isPending}
                      onChange={event => updatePhase(index, { role: event.target.value })}
                    />
                  )}
                  <Button
                    size="icon-sm"
                    tooltip="Remove phase"
                    aria-label={`Remove phase ${index + 1}`}
                    disabled={draft.phases.length === 1 || mutation.isPending}
                    onClick={() => removePhase(index)}
                  >
                    <Trash2 />
                  </Button>
                </div>
                {phase.kind !== 'terminal' && (
                  <div className="flex flex-wrap items-center gap-3">
                    <Txt tone="muted" as="span" variant="caption">
                      Moves to:
                    </Txt>
                    {draft.phases
                      .filter(target => target.id !== phase.id)
                      .map(target => (
                        <label key={target.id} className="flex items-center gap-1">
                          <input
                            type="checkbox"
                            aria-label={`${phase.title} moves to ${target.title}`}
                            checked={phase.next.includes(target.id)}
                            onChange={event =>
                              updatePhase(index, {
                                next: event.target.checked
                                  ? [...phase.next, target.id]
                                  : phase.next.filter(to => to !== target.id),
                              })
                            }
                          />
                          <Txt as="span" variant="caption">
                            {target.title}
                          </Txt>
                        </label>
                      ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
          <Button size="sm" onClick={addPhase} disabled={mutation.isPending}>
            <Plus /> Add phase
          </Button>
          {mutation.error && (
            <Txt as="p" variant="caption" className="text-destructive-foreground" role="alert">
              {errorText(mutation.error, 'Failed to save board')}
            </Txt>
          )}
        </DialogBody>
        <DialogFooter>
          <DialogCancel>Cancel</DialogCancel>
          <DialogAction disabled={!ready} onConfirm={() => void save()}>
            {mutation.isPending ? 'Saving…' : 'Save'}
          </DialogAction>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PhaseRow({
  factoryId,
  board,
  phase,
  override,
  skillNames,
}: {
  factoryId: string;
  board: InstalledBoardInfo;
  phase: InstalledPhaseInfo;
  override: PhaseSkillInfo | undefined;
  skillNames: string[];
}) {
  const mutation = useSetPhaseSkillMutation();
  const [editingPrompt, setEditingPrompt] = useState(false);
  const key = { factoryId, boardId: board.id, phaseId: phase.id };
  const label = `${board.title} ${phase.title}`;
  const value =
    override === undefined
      ? DEFAULT_VALUE
      : override.skillName !== null
        ? `${SKILL_PREFIX}${override.skillName}`
        : PROMPT_VALUE;
  const summary =
    override === undefined ? 'Board default' : override.skillName !== null ? override.skillName : 'Custom prompt';

  const choose = (next: string) => {
    // Radix reports a change when the selected option disappears (its skill was deleted); ignore it.
    const known =
      next === DEFAULT_VALUE || next === PROMPT_VALUE || skillNames.some(name => next === `${SKILL_PREFIX}${name}`);
    if (!known || next === value) return;
    if (next === DEFAULT_VALUE) mutation.mutate({ ...key, kickoff: null });
    else if (next === PROMPT_VALUE) setEditingPrompt(true);
    else mutation.mutate({ ...key, kickoff: { skillName: next.slice(SKILL_PREFIX.length), prompt: null } });
  };

  return (
    <li className="flex flex-col gap-1 px-4 py-3">
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-2">
          <Txt tone="ink" as="span" variant="body">
            {phase.title}
          </Txt>
          {phase.role && <Badge>{phase.role}</Badge>}
        </div>
        <div className="flex items-center gap-2">
          <Select value={value} onValueChange={choose} disabled={mutation.isPending}>
            <SelectTrigger size="sm" aria-label={`Kickoff for ${label}`} className="w-56">
              {summary}
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={DEFAULT_VALUE}>Board default</SelectItem>
              <SelectItem value={PROMPT_VALUE}>Custom prompt…</SelectItem>
              {skillNames.map(name => (
                <SelectItem key={name} value={`${SKILL_PREFIX}${name}`}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {override?.prompt != null && (
            <Button
              size="icon-sm"
              tooltip="Edit prompt"
              aria-label={`Edit prompt for ${label}`}
              onClick={() => setEditingPrompt(true)}
            >
              <Pencil />
            </Button>
          )}
          {override && (
            <Button
              size="icon-sm"
              tooltip="Reset to board default"
              aria-label={`Reset ${label} to board default`}
              onClick={() => mutation.mutate({ ...key, kickoff: null })}
              disabled={mutation.isPending}
            >
              <Trash2 />
            </Button>
          )}
        </div>
      </div>
      {mutation.error && !editingPrompt && (
        <Txt as="p" variant="caption" className="text-destructive-foreground">
          {errorText(mutation.error, 'Failed to save kickoff')}
        </Txt>
      )}
      {editingPrompt && (
        <PromptDialog
          title={label}
          initial={override?.prompt ?? ''}
          pending={mutation.isPending}
          error={mutation.error}
          onSave={prompt =>
            mutation.mutate(
              { ...key, kickoff: { skillName: null, prompt } },
              { onSuccess: () => setEditingPrompt(false) },
            )
          }
          onClose={() => setEditingPrompt(false)}
        />
      )}
    </li>
  );
}

function BoardCard({
  factoryId,
  board,
  overrides,
  skillNames,
}: {
  factoryId: string;
  board: InstalledBoardInfo;
  overrides: PhaseSkillInfo[];
  skillNames: string[];
}) {
  const phases = board.phases.filter(phase => phase.kind === 'working');
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const remove = useDeleteBoardMutation();
  return (
    <section aria-label={`${board.title} board`} className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <Txt tone="ink" as="h4" variant="body" className="m-0">
          {board.title}
        </Txt>
        {board.custom && (
          <div className="flex items-center gap-2">
            <Button
              size="icon-sm"
              tooltip="Edit board"
              aria-label={`Edit ${board.title} board`}
              onClick={() => setEditing(true)}
            >
              <Pencil />
            </Button>
            <Button
              size="icon-sm"
              tooltip="Delete board"
              aria-label={`Delete ${board.title} board`}
              disabled={remove.isPending}
              onClick={() => setConfirmingDelete(true)}
            >
              <Trash2 />
            </Button>
          </div>
        )}
      </div>
      {remove.error && (
        <Txt as="p" variant="caption" className="text-destructive-foreground" role="alert">
          {errorText(remove.error, 'Failed to delete board')}
        </Txt>
      )}
      {confirmingDelete && (
        <ConfirmDeleteDialog
          title={`Delete the ${board.title} board?`}
          description="This removes the board with its phases, transitions, and kickoff settings. This can't be undone."
          pending={remove.isPending}
          onConfirm={() =>
            remove.mutate({ factoryId, boardId: board.id }, { onSettled: () => setConfirmingDelete(false) })
          }
          onClose={() => setConfirmingDelete(false)}
        />
      )}
      {editing && <BoardDialog factoryId={factoryId} board={board} onClose={() => setEditing(false)} />}
      <SettingsContainer>
        {phases.length === 0 ? (
          <Txt tone="muted" as="p" variant="caption" className="px-4 py-3">
            This board has no working phases.
          </Txt>
        ) : (
          <ul className="m-0 flex list-none flex-col p-0">
            {phases.map(phase => (
              <PhaseRow
                key={phase.id}
                factoryId={factoryId}
                board={board}
                phase={phase}
                override={overrides.find(o => o.boardId === board.id && o.phaseId === phase.id)}
                skillNames={skillNames}
              />
            ))}
          </ul>
        )}
      </SettingsContainer>
    </section>
  );
}

export function FactoryBoardsSection({ factoryId }: { factoryId?: string }) {
  const catalog = useBoardCatalog(factoryId);
  const library = useSkillLibraryQuery(factoryId);
  const phaseSkills = usePhaseSkillsQuery(factoryId);
  const boards = catalog.data === undefined ? undefined : orderedBoards(catalog.data);
  const error = catalog.error ?? phaseSkills.error ?? library.error;
  const [creating, setCreating] = useState(false);

  return (
    <SettingsSubsection
      scope="deployment"
      title="Boards"
      description="Choose what an agent runs when a card enters each working phase: the board's built-in kickoff, a skill from your library, or your own prompt."
    >
      {!factoryId ? (
        <Txt tone="muted" as="p" variant="caption">
          Open a Factory to configure its boards.
        </Txt>
      ) : error ? (
        <Txt as="p" variant="caption" className="text-destructive-foreground">
          {errorText(error, 'Failed to load boards')}
        </Txt>
      ) : boards === undefined || phaseSkills.isPending || library.isPending ? (
        <Txt tone="muted" as="p" variant="caption" role="status">
          Loading boards…
        </Txt>
      ) : (
        <div className="flex flex-col gap-5">
          <SkillLibrary factoryId={factoryId} skills={library.data ?? []} />
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setCreating(true)}>
              <Plus /> New board
            </Button>
          </div>
          {creating && <BoardDialog factoryId={factoryId} onClose={() => setCreating(false)} />}
          {boards.length === 0 ? (
            <Txt tone="muted" as="p" variant="caption">
              No boards are installed.
            </Txt>
          ) : (
            boards.map(board => (
              <BoardCard
                key={board.id}
                factoryId={factoryId}
                board={board}
                overrides={phaseSkills.data ?? []}
                skillNames={(library.data ?? []).map(skill => skill.name)}
              />
            ))
          )}
        </div>
      )}
    </SettingsSubsection>
  );
}
