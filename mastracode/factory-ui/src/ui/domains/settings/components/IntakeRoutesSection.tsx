import { AlertDialog } from '@mastra/playground-ui/components/AlertDialog';
import { DEFAULT_BOARD_ID } from '@mastra/factory/boards/default-board';
import { INTAKE_ROUTE_RULE_FIELDS, routeEventsProblem } from '@mastra/factory/boards/board-events';
import { ruleGroupSchema } from '@mastra/factory/rules/rule-group';
import type { RuleGroup } from '@mastra/factory/rules/rule-group';
import { Badge } from '@mastra/playground-ui/components/Badge';
import { Button } from '@mastra/playground-ui/components/Button';
import { Field, FieldLabel } from '@mastra/playground-ui/components/Field';
import { Input } from '@mastra/playground-ui/components/Input';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@mastra/playground-ui/components/Select';
import { Switch } from '@mastra/playground-ui/components/Switch';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from 'lucide-react';
import { useId, useState } from 'react';

import type { InstalledBoardInfo, IntakeRouteInfo } from '../../../../api/types';
import { useBoardCatalog } from '../../../../hooks/useBoardCatalog';
import { useIntakeRoutesQuery, useIntakeRouteWrites } from '../../../../hooks/useIntakeRoutes';
import { boardName, describeEvents, describeTarget, describeWhen, phaseName, sendNewCardsTo } from './intakeRoutes';
import { intakeRouteFacts, RuleEditor } from './RuleEditor';
import { SettingsSubsection } from './SettingsSubsection';

const ROUTE_WHEN_SCHEMA = ruleGroupSchema(INTAKE_ROUTE_RULE_FIELDS);
const STALE_CODES = new Set(['revision_mismatch', 'intake_route_set_mismatch', 'intake_route_not_found']);

interface RouteDraft {
  name: string;
  when: RuleGroup | null;
  boardKey: string;
  phaseKey: string;
}

/** The phases a route can send cards to: a route placing new cards can't land them in a finished phase. */
function targetPhases(board: InstalledBoardInfo | undefined, placesNewCards: boolean) {
  return (board?.phases ?? []).filter(phase => !placesNewCards || phase.kind !== 'terminal');
}

function RouteForm({
  initial,
  boards,
  on,
  saving,
  submitLabel,
  onSave,
  onCancel,
}: {
  initial: RouteDraft;
  boards: InstalledBoardInfo[];
  on: readonly string[];
  saving: boolean;
  submitLabel: string;
  onSave: (draft: RouteDraft) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(initial);
  const [ruleProblem, setRuleProblem] = useState<string>();
  const id = useId();
  const board = boards.find(candidate => candidate.id === draft.boardKey);
  const phases = targetPhases(board, on.includes('work_item.created'));
  // A condition pasted as JSON can name event facts the builder doesn't offer this route.
  const schema = ROUTE_WHEN_SCHEMA.superRefine((when, ctx) => {
    const problem = routeEventsProblem(on, when);
    if (problem) ctx.addIssue({ code: 'custom', message: problem });
  });
  const ready = draft.name.trim() !== '' && board !== undefined && draft.phaseKey !== '' && ruleProblem === undefined;

  return (
    <div className="border-border1 flex flex-col gap-3 rounded-md border p-3">
      <Field>
        <FieldLabel htmlFor={`${id}-name`}>Route name</FieldLabel>
        <Input
          id={`${id}-name`}
          value={draft.name}
          maxLength={120}
          disabled={saving}
          onChange={event => setDraft(current => ({ ...current, name: event.target.value }))}
        />
      </Field>
      <RuleEditor
        label="Applies when"
        description="Leave empty to take every card that reaches this route."
        rule={draft.when}
        facts={intakeRouteFacts(on)}
        schema={schema}
        disabled={saving}
        onChange={(when, problem) => {
          setDraft(current => ({ ...current, when }));
          setRuleProblem(problem);
        }}
      />
      <div className="flex flex-wrap gap-3">
        <Field>
          <FieldLabel>Board</FieldLabel>
          <Select
            value={draft.boardKey}
            disabled={saving}
            onValueChange={boardKey => {
              const next = boards.find(candidate => candidate.id === boardKey);
              setDraft(current => ({ ...current, boardKey, phaseKey: next?.initialPhase ?? '' }));
            }}
          >
            <SelectTrigger size="sm" aria-label="Board" className="w-fit min-w-40">
              <Txt as="span" variant="caption">
                {board ? boardName(board) : 'Choose a board'}
              </Txt>
            </SelectTrigger>
            <SelectContent>
              {boards.map(candidate => (
                <SelectItem key={candidate.id} value={candidate.id}>
                  {boardName(candidate)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel>Phase</FieldLabel>
          <Select
            value={draft.phaseKey}
            disabled={saving || !board}
            onValueChange={phaseKey => setDraft(current => ({ ...current, phaseKey }))}
          >
            <SelectTrigger size="sm" aria-label="Phase" className="w-fit min-w-40">
              <Txt as="span" variant="caption">
                {phaseName(board, draft.phaseKey || null) ?? 'Choose a phase'}
              </Txt>
            </SelectTrigger>
            <SelectContent>
              {phases.map(phase => (
                <SelectItem key={phase.id} value={phase.id}>
                  {phase.name ?? phase.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>
      <div className="flex justify-end gap-2">
        <Button size="sm" disabled={saving} onClick={onCancel}>
          Cancel
        </Button>
        <Button size="sm" variant="primary" disabled={!ready || saving} onClick={() => onSave(draft)}>
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}

function RouteRow({
  route,
  boards,
  index,
  count,
  readOnly,
  saving,
  onToggle,
  onMove,
  onEdit,
  onDelete,
}: {
  route: IntakeRouteInfo;
  boards: InstalledBoardInfo[];
  index: number;
  count: number;
  readOnly: boolean;
  saving: boolean;
  onToggle: (enabled: boolean) => void;
  onMove: (offset: -1 | 1) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-2">
        <Txt as="span" variant="caption" tone="muted" className="w-5 tabular-nums">
          {index + 1}.
        </Txt>
        <Switch
          aria-label={`Use ${route.name}`}
          checked={route.enabled}
          disabled={readOnly || saving}
          onCheckedChange={onToggle}
        />
        <Txt as="span" variant="body-sm" className="min-w-0 flex-1 truncate">
          {route.name}
        </Txt>
        {!route.on.includes('work_item.created') && <Badge>Moves cards</Badge>}
        {!readOnly && (
          <div className="flex gap-1">
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label={`Move ${route.name} up`}
              disabled={saving || index === 0}
              onClick={() => onMove(-1)}
            >
              <ArrowUp />
            </Button>
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label={`Move ${route.name} down`}
              disabled={saving || index === count - 1}
              onClick={() => onMove(1)}
            >
              <ArrowDown />
            </Button>
            <Button size="icon-sm" variant="ghost" aria-label={`Edit ${route.name}`} disabled={saving} onClick={onEdit}>
              <Pencil />
            </Button>
            <AlertDialog>
              <AlertDialog.Trigger
                render={
                  <Button size="icon-sm" variant="ghost" aria-label={`Delete ${route.name}`} disabled={saving}>
                    <Trash2 />
                  </Button>
                }
              />
              <AlertDialog.Content>
                <AlertDialog.Header>
                  <AlertDialog.Title>Delete {route.name}?</AlertDialog.Title>
                  <AlertDialog.Description>
                    {route.createdBy === 'factory'
                      ? 'Factory added this route and won’t add it back. You can recreate it yourself.'
                      : 'This can’t be undone.'}
                  </AlertDialog.Description>
                </AlertDialog.Header>
                <AlertDialog.Footer>
                  <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
                  <AlertDialog.Action onClick={onDelete}>Delete</AlertDialog.Action>
                </AlertDialog.Footer>
              </AlertDialog.Content>
            </AlertDialog>
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 pl-7">
        <Txt as="span" variant="caption" tone="muted">
          {describeEvents(route.on)}
        </Txt>
        <Txt as="span" variant="caption" tone="muted">
          When: {describeWhen(route.when)}
        </Txt>
        <Txt as="span" variant="caption" tone="muted">
          Goes to: {describeTarget(route, boards)}
        </Txt>
      </div>
      {route.problems.map(problem => (
        <Notice key={problem} variant="warning">
          {problem}
        </Notice>
      ))}
    </div>
  );
}

function SendNewCardsTo({
  boards,
  saving,
  onSend,
}: {
  boards: InstalledBoardInfo[];
  saving: boolean;
  onSend: (boardKey: string) => void;
}) {
  const [boardKey, setBoardKey] = useState<string>();
  const board = boards.find(candidate => candidate.id === boardKey);
  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-2">
        <Txt as="span" variant="body-sm">
          Send new cards to
        </Txt>
        <Select value={boardKey ?? ''} disabled={saving} onValueChange={setBoardKey}>
          <SelectTrigger size="sm" aria-label="Board for new cards" className="w-fit min-w-40">
            <Txt as="span" variant="caption">
              {board ? boardName(board) : 'Choose a board'}
            </Txt>
          </SelectTrigger>
          <SelectContent>
            {boards.map(candidate => (
              <SelectItem key={candidate.id} value={candidate.id}>
                {boardName(candidate)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="sm" disabled={saving || !board} onClick={() => board && onSend(board.id)}>
          Apply
        </Button>
      </div>
      <Txt as="p" variant="caption" tone="muted">
        This changes the route that takes every new card no route above it takes. Routes above it still apply: by
        default, outside authors’ items wait in Work › Intake and pull requests go to Work › Review.
      </Txt>
      <Txt as="p" variant="caption" tone="muted">
        To send only one repository, team or project there, add a route that applies when Source › Repository, team or
        project is, for example, <code>acme/app</code> (a GitHub or GitLab repository), <code>ENG</code> (a Linear team)
        or <code>OPS</code> (a Jira project).
      </Txt>
    </div>
  );
}

/**
 * The project's intake routes: the only thing that decides where a new card lands, and how status
 * events (closed, reopened, merged) move cards. Tried top to bottom; the first match wins.
 */
export function IntakeRoutesSection({ factoryId }: { factoryId?: string }) {
  const query = useIntakeRoutesQuery(factoryId);
  const boards = useBoardCatalog(factoryId).data ?? [];
  const writes = useIntakeRouteWrites(factoryId);
  const [editing, setEditing] = useState<string | 'new'>();
  const routes = query.data?.intakeRoutes ?? [];
  const readOnly = !(query.data?.canEdit ?? false);
  const saving = writes.isPending;
  const stale = writes.error ? STALE_CODES.has(writes.error.code ?? '') : false;

  const run = (changes: Parameters<typeof writes.mutate>[0], onDone?: () => void) => {
    writes.mutate(changes, { onSuccess: () => onDone?.() });
  };
  const move = (index: number, offset: -1 | 1) => {
    const ids = routes.map(route => route.id);
    const [moved] = ids.splice(index, 1);
    ids.splice(index + offset, 0, moved);
    run([{ kind: 'reorder', ids }]);
  };
  const defaultBoard = boards.find(board => board.id === DEFAULT_BOARD_ID) ?? boards[0];

  return (
    <SettingsSubsection
      scope="factory"
      title="Intake routes"
      description="Where this Factory's new cards land, and how closing, reopening, or merging moves them. Routes are tried top to bottom and the first match wins. Changes apply to this Factory only."
    >
      {!factoryId && <Notice variant="info">Open a Factory to edit its intake routes.</Notice>}
      {factoryId && query.isPending && (
        <Txt tone="muted" as="p" variant="caption" role="status">
          Loading intake routes…
        </Txt>
      )}
      {query.error && <Notice variant="destructive">{query.error.message}</Notice>}
      {factoryId && query.data && (
        <div className="flex flex-col gap-4">
          {readOnly && <Notice variant="info">Only organization admins can change intake routes.</Notice>}
          {!readOnly && boards.length > 0 && (
            <SendNewCardsTo boards={boards} saving={saving} onSend={key => run(sendNewCardsTo(routes, boards, key))} />
          )}
          {stale && (
            <Notice
              variant="warning"
              title="Someone else changed these routes"
              action={
                <Button
                  size="sm"
                  onClick={() => {
                    writes.reset();
                    setEditing(undefined);
                    void query.refetch();
                  }}
                >
                  Reload
                </Button>
              }
            >
              They changed since you opened them, so your edit was not saved. Reload to see the latest routes, then edit
              them again.
            </Notice>
          )}
          {writes.error && !stale && (
            <Notice variant="destructive" role="alert" title="The routes were not saved">
              {writes.error.message}
            </Notice>
          )}
          {routes.length === 0 && (
            <Txt as="p" variant="caption" tone="muted">
              No routes. New cards go to the default board’s first phase.
            </Txt>
          )}
          <ol className="flex flex-col gap-3" aria-label="Intake routes">
            {routes.map((route, index) => (
              <li key={route.id}>
                {editing === route.id ? (
                  <RouteForm
                    initial={{
                      name: route.name,
                      when: route.when,
                      boardKey: route.target.boardKey,
                      phaseKey:
                        route.target.phaseKey ??
                        boards.find(board => board.id === route.target.boardKey)?.initialPhase ??
                        '',
                    }}
                    boards={boards}
                    on={route.on}
                    saving={saving}
                    submitLabel="Save"
                    onCancel={() => setEditing(undefined)}
                    onSave={draft =>
                      run(
                        [
                          {
                            kind: 'update',
                            id: route.id,
                            patch: {
                              name: draft.name.trim(),
                              when: draft.when,
                              target: {
                                boardKey: draft.boardKey,
                                phaseKey: draft.phaseKey,
                                ...(route.target.joinClosedIssue ? { joinClosedIssue: true } : {}),
                              },
                              expectedRevision: route.revision,
                            },
                          },
                        ],
                        () => setEditing(undefined),
                      )
                    }
                  />
                ) : (
                  <RouteRow
                    route={route}
                    boards={boards}
                    index={index}
                    count={routes.length}
                    readOnly={readOnly}
                    saving={saving}
                    onToggle={enabled =>
                      run([{ kind: 'update', id: route.id, patch: { enabled, expectedRevision: route.revision } }])
                    }
                    onMove={offset => move(index, offset)}
                    onEdit={() => setEditing(route.id)}
                    onDelete={() => run([{ kind: 'delete', id: route.id, expectedRevision: route.revision }])}
                  />
                )}
              </li>
            ))}
          </ol>
          {!readOnly &&
            (editing === 'new' ? (
              <RouteForm
                initial={{
                  name: '',
                  when: null,
                  boardKey: defaultBoard?.id ?? '',
                  phaseKey: defaultBoard?.initialPhase ?? '',
                }}
                boards={boards}
                on={['work_item.created']}
                saving={saving}
                submitLabel="Add route"
                onCancel={() => setEditing(undefined)}
                onSave={draft =>
                  run(
                    [
                      {
                        kind: 'create',
                        route: {
                          name: draft.name.trim(),
                          when: draft.when,
                          target: { boardKey: draft.boardKey, phaseKey: draft.phaseKey },
                        },
                      },
                    ],
                    () => setEditing(undefined),
                  )
                }
              />
            ) : (
              <div>
                <Button size="sm" icon={<Plus />} disabled={saving} onClick={() => setEditing('new')}>
                  Add route
                </Button>
              </div>
            ))}
        </div>
      )}
    </SettingsSubsection>
  );
}
