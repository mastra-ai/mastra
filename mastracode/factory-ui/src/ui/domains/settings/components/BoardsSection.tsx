import { Button } from '@mastra/playground-ui/components/Button';
import { Input } from '@mastra/playground-ui/components/Input';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@mastra/playground-ui/components/Select';
import { Switch } from '@mastra/playground-ui/components/Switch';
import { Textarea } from '@mastra/playground-ui/components/Textarea';
import { toast } from '@mastra/playground-ui/components/Toaster';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { SettingsContainer, SettingsFieldsetRow, SettingsRow } from '@mastra/playground-ui/new/settings';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';

import type {
  BoardConfigUpdateBody,
  StoredBoardConfig,
  StoredBoardInfo,
  StoredIntakeRouteInfo,
} from '../../../../api/types';
import {
  useBoardConfigQuery,
  useBoardRunnersQuery,
  useSaveBoardConfigMutation,
} from '../../../../hooks/useBoardConfig';
import { SkeletonRows } from '../../../ui/SkeletonRows';
import { SettingsSubsection } from './SettingsSubsection';
import {
  BOARD_EVENTS,
  CARD_FIELDS,
  EVENT_FIELDS,
  INTAKE_FIELDS,
  describeCondition,
  isListOperator,
  listText,
  move,
  needsValue,
  newCondition,
  operatorsFor,
  parseList,
  parseValue,
  removePhase,
  renamePhase,
  valueText,
} from './boardSettings';
import type { FieldOption, RuleCondition, RuleGroup, RuleNode, StoredEventRoute, StoredPhase } from './boardSettings';

const FIRST_PHASE = '__first_phase__';
const NONE = '__none__';
const MAX_DEPTH = 3;

/** Runner ids the server can run, as returned beside the board config. */
const RunnersContext = createContext<readonly string[]>([]);

function toUpdateBody(config: StoredBoardConfig): BoardConfigUpdateBody {
  return {
    expectedRevision: config.revision,
    config: {
      boards: config.boards.map(({ id: _id, ...board }) => board),
      intakeRoutes: config.intakeRoutes,
    },
  };
}

/** Everything about the project's stored boards: boards, phases, runners, routes. */
export function BoardsSection({ factoryId }: { factoryId: string | undefined }) {
  const query = useBoardConfigQuery(factoryId);
  const runners = useBoardRunnersQuery(factoryId).data;
  const runnerIds = useMemo(() => runners?.map(runner => runner.id) ?? [], [runners]);
  const [draft, setDraft] = useState<StoredBoardConfig | null>(null);

  useEffect(() => {
    if (query.data) setDraft(query.data);
  }, [query.data]);

  if (!factoryId) return null;
  if (query.isError) {
    return (
      <SettingsSubsection scope="factory" title="Boards">
        <SettingsContainer>
          <SettingsRow label="Boards are unavailable right now." />
        </SettingsContainer>
      </SettingsSubsection>
    );
  }
  if (!draft) return <SkeletonRows label="Loading boards" />;

  return (
    <RunnersContext.Provider value={runnerIds}>
      <BoardsEditor factoryId={factoryId} saved={query.data ?? draft} draft={draft} setDraft={setDraft} />
    </RunnersContext.Provider>
  );
}

function BoardsEditor({
  factoryId,
  saved,
  draft,
  setDraft,
}: {
  factoryId: string;
  saved: StoredBoardConfig;
  draft: StoredBoardConfig;
  setDraft: (next: StoredBoardConfig) => void;
}) {
  const save = useSaveBoardConfigMutation(factoryId);
  // Revision 0 means the project stores no boards yet: what is shown is the default, saved on Save.
  const unstored = saved.revision === 0 && draft.boards.length > 0;
  const dirty = unstored || JSON.stringify(toUpdateBody(draft)) !== JSON.stringify(toUpdateBody(saved));
  const disabled = save.isPending;

  const updateBoard = (index: number, next: StoredBoardInfo) =>
    setDraft({ ...draft, boards: draft.boards.map((board, at) => (at === index ? next : board)) });

  const onSave = () =>
    save.mutate(toUpdateBody(draft), {
      onSuccess: () => toast.success(unstored ? 'Boards stored' : 'Boards saved'),
      onError: error => toast.error(error instanceof Error ? error.message : 'Failed to save boards'),
    });

  const action = (
    <div className="flex items-center gap-2">
      <Button size="sm" variant="ghost" disabled={!dirty || unstored || disabled} onClick={() => setDraft(saved)}>
        Discard
      </Button>
      <Button size="sm" disabled={!dirty || disabled} onClick={onSave}>
        {unstored ? 'Store boards' : 'Save'}
      </Button>
    </div>
  );

  return (
    <div className="flex flex-col gap-8">
      <SettingsSubsection
        scope="factory"
        title="Boards"
        description="Boards, phases and routes this project runs from its database. Changes apply after Save."
        action={action}
      >
        <SettingsContainer>
          {unstored && (
            <SettingsRow
              label="Not stored yet"
              description="This is the default Work board, with issues and pull requests on one board. Store it to run this project from the database."
            />
          )}
          {draft.boards.length === 0 && (
            <SettingsRow label="No stored boards" description="This project runs the boards installed in code." />
          )}
          <AddBoard
            disabled={disabled}
            taken={draft.boards.map(board => board.key)}
            onAdd={board => setDraft({ ...draft, boards: [...draft.boards, board] })}
          />
        </SettingsContainer>
      </SettingsSubsection>

      {draft.boards.map((board, index) => (
        <BoardEditor
          key={index}
          board={board}
          disabled={disabled}
          action={action}
          onChange={next => updateBoard(index, next)}
          onRenamePhase={(from, to) => setDraft(renamePhase(draft, board.key, from, to))}
          onRemovePhase={key => setDraft(removePhase(draft, board.key, key))}
          onRemove={() =>
            setDraft({
              ...draft,
              boards: draft.boards.filter((_, at) => at !== index),
              intakeRoutes: draft.intakeRoutes.filter(route => route.boardKey !== board.key),
            })
          }
        />
      ))}

      {draft.boards.length > 0 && (
        <IntakeRoutes
          routes={draft.intakeRoutes}
          boards={draft.boards}
          disabled={disabled}
          onChange={intakeRoutes => setDraft({ ...draft, intakeRoutes })}
          action={action}
        />
      )}
    </div>
  );
}

function AddBoard({
  disabled,
  taken,
  onAdd,
}: {
  disabled: boolean;
  taken: string[];
  onAdd: (board: StoredBoardInfo) => void;
}) {
  const [key, setKey] = useState('');
  const [name, setName] = useState('');
  const clean = key.trim().toLowerCase();
  const valid = /^[a-z0-9][a-z0-9_-]*$/.test(clean) && !taken.includes(clean) && name.trim().length > 0;
  return (
    <SettingsFieldsetRow
      label="Add board"
      description="Starts with Open → Doing → Done. Key is permanent once cards use it."
    >
      <div className="flex items-center gap-2">
        <Input
          size="sm"
          aria-label="New board key"
          placeholder="key, e.g. ops"
          value={key}
          disabled={disabled}
          onChange={event => setKey(event.target.value)}
        />
        <Input
          size="sm"
          aria-label="New board name"
          placeholder="name"
          value={name}
          disabled={disabled}
          onChange={event => setName(event.target.value)}
        />
        <Button
          size="sm"
          disabled={disabled || !valid}
          onClick={() => {
            onAdd({
              id: '',
              key: clean,
              name: name.trim(),
              description: null,
              phases: [
                emptyPhase('open', 'Open', 'resting'),
                emptyPhase('doing', 'Doing', 'resting'),
                emptyPhase('done', 'Done', 'terminal'),
              ],
              eventRoutes: [],
            });
            setKey('');
            setName('');
          }}
        >
          Add
        </Button>
      </div>
    </SettingsFieldsetRow>
  );
}

function emptyPhase(key: string, name: string, kind: StoredPhase['kind']): StoredPhase {
  return { key, name, description: null, kind, runner: null, nextPhases: null, exitTool: null, autoApproveWhen: null };
}

function BoardEditor({
  board,
  disabled,
  action,
  onChange,
  onRenamePhase,
  onRemovePhase,
  onRemove,
}: {
  board: StoredBoardInfo;
  disabled: boolean;
  action: React.ReactNode;
  onChange: (next: StoredBoardInfo) => void;
  onRenamePhase: (from: string, to: string) => void;
  onRemovePhase: (key: string) => void;
  onRemove: () => void;
}) {
  const setPhase = (index: number, patch: Partial<StoredPhase>) =>
    onChange({ ...board, phases: board.phases.map((phase, at) => (at === index ? { ...phase, ...patch } : phase)) });
  const phaseKeys = board.phases.map(phase => phase.key);
  const newKey = () => {
    let n = board.phases.length + 1;
    while (phaseKeys.includes(`phase-${n}`)) n += 1;
    return `phase-${n}`;
  };

  return (
    <SettingsSubsection
      scope="factory"
      title={`${board.name} board`}
      description={`Key: ${board.key}. Phases run top to bottom; a card enters the first phase unless a route says otherwise.`}
      action={action}
    >
      <SettingsContainer>
        <SettingsFieldsetRow label="Board">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <LabeledInput
              label="Name"
              value={board.name}
              disabled={disabled}
              onCommit={name => onChange({ ...board, name: name.trim() || board.name })}
            />
            <LabeledInput
              label="Description"
              value={board.description ?? ''}
              disabled={disabled}
              onCommit={description => onChange({ ...board, description: description.trim() || null })}
            />
          </div>
          <div className="mt-2">
            <Button size="sm" variant="ghost" disabled={disabled} onClick={onRemove}>
              Remove board
            </Button>
          </div>
        </SettingsFieldsetRow>

        {board.phases.map((phase, index) => (
          <PhaseEditor
            key={index}
            phase={phase}
            index={index}
            count={board.phases.length}
            phaseKeys={phaseKeys}
            disabled={disabled}
            onChange={patch => setPhase(index, patch)}
            onRename={to => onRenamePhase(phase.key, to)}
            onMove={by => onChange({ ...board, phases: move(board.phases, index, by) })}
            onRemove={() => onRemovePhase(phase.key)}
          />
        ))}
        <SettingsRow label="Add phase">
          <Button
            size="sm"
            disabled={disabled}
            onClick={() => {
              const key = newKey();
              // Keep terminal phases last.
              const at = board.phases.findIndex(phase => phase.kind === 'terminal');
              const phases = [...board.phases];
              phases.splice(at === -1 ? phases.length : at, 0, emptyPhase(key, 'New phase', 'resting'));
              onChange({ ...board, phases });
            }}
          >
            Add phase
          </Button>
        </SettingsRow>
      </SettingsContainer>

      <div className="mt-6">
        <EventRoutes board={board} disabled={disabled} onChange={eventRoutes => onChange({ ...board, eventRoutes })} />
      </div>
    </SettingsSubsection>
  );
}

function PhaseEditor({
  phase,
  index,
  count,
  phaseKeys,
  disabled,
  onChange,
  onRename,
  onMove,
  onRemove,
}: {
  phase: StoredPhase;
  index: number;
  count: number;
  phaseKeys: string[];
  disabled: boolean;
  onChange: (patch: Partial<StoredPhase>) => void;
  onRename: (to: string) => void;
  onMove: (by: -1 | 1) => void;
  onRemove: () => void;
}) {
  const runnerType = phase.runner?.type ?? NONE;
  const runnerIds = useContext(RunnersContext);
  return (
    <SettingsFieldsetRow label={`${index + 1}. ${phase.name}`} description={`${phase.kind} · key ${phase.key}`}>
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <LabeledInput
            label="Name"
            value={phase.name}
            disabled={disabled}
            onCommit={name => onChange({ name: name.trim() || phase.name })}
          />
          <LabeledInput
            label="Key"
            value={phase.key}
            disabled={disabled}
            onCommit={value => {
              const key = value.trim().toLowerCase();
              if (key && key !== phase.key && /^[a-z0-9][a-z0-9_-]*$/.test(key) && !phaseKeys.includes(key))
                onRename(key);
            }}
          />
          <LabeledSelect
            label="Kind"
            value={phase.kind}
            disabled={disabled}
            options={[
              { value: 'resting', title: 'Resting (waits for a person)' },
              { value: 'working', title: 'Working (runs an agent)' },
              { value: 'terminal', title: 'Terminal (done)' },
            ]}
            onChange={value => {
              const kind = value as StoredPhase['kind'];
              onChange(
                kind === 'working'
                  ? { kind }
                  : { kind, ...(kind === 'resting' ? { runner: null } : {}), exitTool: null, autoApproveWhen: null },
              );
            }}
          />
        </div>
        <LabeledInput
          label="Description"
          value={phase.description ?? ''}
          disabled={disabled}
          onCommit={description => onChange({ description: description.trim() || null })}
        />

        {phase.kind !== 'resting' && (
          <div className="flex flex-col gap-2 rounded-lg border border-border1 p-3">
            <LabeledSelect
              label="Runner"
              value={runnerType}
              disabled={disabled}
              options={[
                { value: NONE, title: 'None' },
                ...(runnerIds.length || runnerType === 'workflow' ? [{ value: 'workflow', title: 'Code runner' }] : []),
                { value: 'agent', title: 'Agent with skill or instructions' },
              ]}
              onChange={value =>
                onChange({
                  runner:
                    value === 'workflow'
                      ? { type: 'workflow', workflowId: runnerIds[0] }
                      : value === 'agent'
                        ? { type: 'agent', agentId: 'factory', instructions: '' }
                        : null,
                })
              }
            />
            {phase.runner?.type === 'workflow' && (
              <LabeledSelect
                label="Runner id"
                value={phase.runner.workflowId}
                disabled={disabled}
                options={[
                  ...runnerIds.map(id => ({ value: id, title: id })),
                  ...(runnerIds.includes(phase.runner.workflowId)
                    ? []
                    : [{ value: phase.runner.workflowId, title: `${phase.runner.workflowId} (unknown)` }]),
                ]}
                onChange={workflowId => onChange({ runner: { type: 'workflow', workflowId } })}
              />
            )}
            {phase.runner?.type === 'agent' && (
              <AgentRunnerEditor phase={phase} disabled={disabled} onChange={onChange} />
            )}
          </div>
        )}

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <LabeledInput
            label={`Next phases (${phaseKeys.filter(key => key !== phase.key).join(', ')})`}
            placeholder="any"
            value={listText(phase.nextPhases)}
            disabled={disabled}
            onCommit={value => onChange({ nextPhases: parseList(value) })}
          />
          {phase.kind === 'working' && (
            <LabeledInput
              label="Exit tool (moves the card to the next phase)"
              placeholder="none, e.g. submit_plan"
              value={phase.exitTool ?? ''}
              disabled={disabled}
              onCommit={value => {
                const exitTool = value.trim() || null;
                onChange({ exitTool, ...(exitTool ? {} : { autoApproveWhen: null }) });
              }}
            />
          )}
        </div>

        {phase.kind === 'working' && phase.exitTool && (
          <div className="flex flex-col gap-1">
            <Txt as="span" variant="caption" className="text-muted-foreground">
              Auto-approve {phase.exitTool} when
            </Txt>
            <ConditionEditor
              value={phase.autoApproveWhen}
              fields={CARD_FIELDS}
              disabled={disabled}
              emptyText="Never — a person approves"
              onChange={autoApproveWhen => onChange({ autoApproveWhen })}
            />
          </div>
        )}

        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" disabled={disabled || index === 0} onClick={() => onMove(-1)}>
            Move up
          </Button>
          <Button size="sm" variant="ghost" disabled={disabled || index === count - 1} onClick={() => onMove(1)}>
            Move down
          </Button>
          <Button size="sm" variant="ghost" disabled={disabled || count <= 2} onClick={onRemove}>
            Remove phase
          </Button>
        </div>
      </div>
    </SettingsFieldsetRow>
  );
}

function AgentRunnerEditor({
  phase,
  disabled,
  onChange,
}: {
  phase: StoredPhase;
  disabled: boolean;
  onChange: (patch: Partial<StoredPhase>) => void;
}) {
  const runner = phase.runner as Extract<NonNullable<StoredPhase['runner']>, { type: 'agent' }>;
  const set = (patch: Partial<typeof runner>) => {
    const next = { ...runner, ...patch };
    // `context` replaces the earlier `seat`; saving writes the new name only.
    if ('context' in patch) delete next.seat;
    // Drop empty optional fields so the stored runner stays clean.
    for (const key of ['skill', 'model', 'instructions'] as const) {
      if (next[key] === '' || next[key] === undefined) delete next[key];
    }
    onChange({ runner: next });
  };
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <LabeledInput
          label="Agent name"
          value={runner.agentId}
          disabled={disabled}
          onCommit={agentId => set({ agentId: agentId.trim() || runner.agentId })}
        />
        <LabeledInput
          label="Skill (optional)"
          placeholder="e.g. factory-plan"
          value={runner.skill ?? ''}
          disabled={disabled}
          onCommit={skill => set({ skill: skill.trim() })}
        />
        <LabeledInput
          label="Context (optional)"
          placeholder="main"
          value={runner.context ?? runner.seat ?? ''}
          disabled={disabled}
          onCommit={context => set({ context: context.trim() || null })}
        />
      </div>
      <Txt as="span" variant="caption" className="text-muted-foreground">
        Phases with the same context continue one session; a new context starts a fresh one. Empty is the card's main
        context.
      </Txt>
      <LabeledInput
        label="Model (optional)"
        placeholder="project default"
        value={runner.model ?? ''}
        disabled={disabled}
        onCommit={model => set({ model: model.trim() })}
      />
      <LabeledTextarea
        label="Instructions (sent with the skill, or as the prompt when there is no skill)"
        value={runner.instructions ?? ''}
        disabled={disabled}
        onCommit={instructions => set({ instructions })}
      />
    </div>
  );
}

function EventRoutes({
  board,
  disabled,
  onChange,
}: {
  board: StoredBoardInfo;
  disabled: boolean;
  onChange: (next: StoredEventRoute[]) => void;
}) {
  const routes = board.eventRoutes;
  const phases = board.phases.map(phase => ({ value: phase.key, title: phase.name }));
  const set = (index: number, patch: Partial<StoredEventRoute>) =>
    onChange(routes.map((route, at) => (at === index ? { ...route, ...patch } : route)));
  return (
    <SettingsContainer>
      <SettingsRow
        label="Event routes"
        description="Where a pull request or issue event moves a card on this board. First matching route wins."
      />
      {routes.map((route, index) => (
        <SettingsFieldsetRow key={index} label={`${route.event} → ${route.toPhaseKey}`}>
          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <LabeledSelect
                label="Event"
                value={route.event}
                disabled={disabled}
                options={BOARD_EVENTS.map(event => ({ value: event, title: event }))}
                onChange={event => set(index, { event: event as StoredEventRoute['event'] })}
              />
              <LabeledInput
                label="From phases"
                placeholder="any"
                value={listText(route.fromPhases)}
                disabled={disabled}
                onCommit={value => set(index, { fromPhases: parseList(value) })}
              />
              <LabeledSelect
                label="Move to"
                value={route.toPhaseKey}
                disabled={disabled}
                options={phases}
                onChange={toPhaseKey => set(index, { toPhaseKey })}
              />
            </div>
            <ConditionEditor
              value={route.when}
              fields={EVENT_FIELDS}
              disabled={disabled}
              emptyText="Always"
              onChange={when => set(index, { when })}
            />
            <RouteControls
              enabled={route.enabled}
              index={index}
              count={routes.length}
              disabled={disabled}
              onEnabled={enabled => set(index, { enabled })}
              onMove={by => onChange(move(routes, index, by))}
              onRemove={() => onChange(routes.filter((_, at) => at !== index))}
            />
          </div>
        </SettingsFieldsetRow>
      ))}
      <SettingsRow label="Add event route">
        <Button
          size="sm"
          disabled={disabled}
          onClick={() =>
            onChange([
              ...routes,
              {
                event: BOARD_EVENTS[0],
                fromPhases: null,
                when: null,
                toPhaseKey: board.phases[board.phases.length - 1].key,
                enabled: true,
              },
            ])
          }
        >
          Add event route
        </Button>
      </SettingsRow>
    </SettingsContainer>
  );
}

function IntakeRoutes({
  routes,
  boards,
  disabled,
  onChange,
  action,
}: {
  routes: StoredIntakeRouteInfo[];
  boards: StoredBoardInfo[];
  disabled: boolean;
  onChange: (next: StoredIntakeRouteInfo[]) => void;
  action: React.ReactNode;
}) {
  const targets = boards.flatMap(board => [
    { value: `${board.key}:${FIRST_PHASE}`, title: `${board.name} · first phase` },
    ...board.phases.map(phase => ({ value: `${board.key}:${phase.key}`, title: `${board.name} · ${phase.name}` })),
  ]);
  const targetOf = (route: StoredIntakeRouteInfo) => `${route.boardKey}:${route.phaseKey ?? FIRST_PHASE}`;
  const routeTo = (value: string) => {
    const [boardKey, phaseKey] = value.split(':') as [string, string];
    return { boardKey, phaseKey: phaseKey === FIRST_PHASE ? null : phaseKey };
  };
  const set = (index: number, patch: Partial<StoredIntakeRouteInfo>) =>
    onChange(routes.map((route, at) => (at === index ? { ...route, ...patch } : route)));

  return (
    <SettingsSubsection
      scope="factory"
      title="Intake routes"
      description="Where new items land. Checked top to bottom; a route without a condition catches everything."
      action={action}
    >
      <SettingsContainer>
        {routes.map((route, index) => (
          <SettingsFieldsetRow key={index} label={`${index + 1}. ${describeCondition(route.when, INTAKE_FIELDS)}`}>
            <div className="flex flex-col gap-2">
              <LabeledSelect
                label="Goes to"
                value={targetOf(route)}
                disabled={disabled}
                options={targets}
                onChange={value => set(index, routeTo(value))}
              />
              <ConditionEditor
                value={route.when}
                fields={INTAKE_FIELDS}
                disabled={disabled}
                emptyText="Everything (catch-all)"
                onChange={when => set(index, { when })}
              />
              <RouteControls
                enabled={route.enabled}
                index={index}
                count={routes.length}
                disabled={disabled}
                onEnabled={enabled => set(index, { enabled })}
                onMove={by => onChange(move(routes, index, by))}
                onRemove={() => onChange(routes.filter((_, at) => at !== index))}
              />
            </div>
          </SettingsFieldsetRow>
        ))}
        <SettingsRow label="Add route">
          <Button
            size="sm"
            disabled={disabled}
            onClick={() => {
              // Conditional routes are checked before catch-alls, so put the new one ahead of them.
              const firstFallback = routes.findIndex(route => !route.when);
              const route: StoredIntakeRouteInfo = {
                when: { operator: 'AND', conditions: [newCondition(INTAKE_FIELDS)] },
                enabled: true,
                boardKey: boards[0].key,
                phaseKey: null,
              };
              const at = firstFallback === -1 ? routes.length : firstFallback;
              onChange([...routes.slice(0, at), route, ...routes.slice(at)]);
            }}
          >
            Add route
          </Button>
        </SettingsRow>
      </SettingsContainer>
    </SettingsSubsection>
  );
}

function RouteControls({
  enabled,
  index,
  count,
  disabled,
  onEnabled,
  onMove,
  onRemove,
}: {
  enabled: boolean;
  index: number;
  count: number;
  disabled: boolean;
  onEnabled: (enabled: boolean) => void;
  onMove: (by: -1 | 1) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <Switch
        aria-label={`Route ${index + 1} enabled`}
        checked={enabled}
        disabled={disabled}
        onCheckedChange={onEnabled}
      />
      <Txt as="span" variant="caption" className="text-muted-foreground">
        {enabled ? 'On' : 'Off'}
      </Txt>
      <Button size="sm" variant="ghost" disabled={disabled || index === 0} onClick={() => onMove(-1)}>
        Up
      </Button>
      <Button size="sm" variant="ghost" disabled={disabled || index === count - 1} onClick={() => onMove(1)}>
        Down
      </Button>
      <Button size="sm" variant="ghost" aria-label={`Remove route ${index + 1}`} disabled={disabled} onClick={onRemove}>
        Remove
      </Button>
    </div>
  );
}

/** Edits a rule group: all/any of conditions (field · operator · value), nested up to three levels. */
function ConditionEditor({
  value,
  fields,
  disabled,
  emptyText,
  onChange,
}: {
  value: RuleGroup | null;
  fields: FieldOption[];
  disabled: boolean;
  emptyText: string;
  onChange: (next: RuleGroup | null) => void;
}) {
  if (!value) {
    return (
      <div className="flex items-center gap-2">
        <Txt as="span" variant="caption" className="text-muted-foreground">
          {emptyText}
        </Txt>
        <Button
          size="sm"
          variant="ghost"
          disabled={disabled}
          onClick={() => onChange({ operator: 'AND', conditions: [newCondition(fields)] })}
        >
          Add condition
        </Button>
      </div>
    );
  }
  return (
    <GroupEditor
      group={value}
      fields={fields}
      depth={1}
      disabled={disabled}
      onChange={next => onChange(next && next.conditions.length ? next : null)}
    />
  );
}

function GroupEditor({
  group,
  fields,
  depth,
  disabled,
  onChange,
  onRemove,
}: {
  group: RuleGroup;
  fields: FieldOption[];
  depth: number;
  disabled: boolean;
  onChange: (next: RuleGroup) => void;
  onRemove?: () => void;
}) {
  const setNode = (index: number, node: RuleNode) =>
    onChange({ ...group, conditions: group.conditions.map((existing, at) => (at === index ? node : existing)) });
  const removeNode = (index: number) =>
    onChange({ ...group, conditions: group.conditions.filter((_, at) => at !== index) });

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border1 p-2">
      <div className="flex items-center gap-2">
        <Txt as="span" variant="caption" className="text-muted-foreground">
          Match
        </Txt>
        <PlainSelect
          ariaLabel="Match all or any"
          value={group.operator}
          disabled={disabled}
          options={[
            { value: 'AND', title: 'all of' },
            { value: 'OR', title: 'any of' },
          ]}
          onChange={operator => onChange({ ...group, operator: operator as RuleGroup['operator'] })}
        />
        {onRemove && (
          <Button size="sm" variant="ghost" disabled={disabled} onClick={onRemove}>
            Remove group
          </Button>
        )}
      </div>
      {group.conditions.map((node, index) =>
        'field' in node ? (
          <ConditionRow
            key={index}
            condition={node}
            fields={fields}
            disabled={disabled}
            onChange={next => setNode(index, next)}
            onRemove={() => removeNode(index)}
          />
        ) : (
          <div key={index} className="pl-4">
            <GroupEditor
              group={node}
              fields={fields}
              depth={depth + 1}
              disabled={disabled}
              onChange={next => setNode(index, next)}
              onRemove={() => removeNode(index)}
            />
          </div>
        ),
      )}
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="ghost"
          disabled={disabled}
          onClick={() => onChange({ ...group, conditions: [...group.conditions, newCondition(fields)] })}
        >
          Add condition
        </Button>
        {depth < MAX_DEPTH && (
          <Button
            size="sm"
            variant="ghost"
            disabled={disabled}
            onClick={() =>
              onChange({
                ...group,
                conditions: [...group.conditions, { operator: 'OR', conditions: [newCondition(fields)] }],
              })
            }
          >
            Add group
          </Button>
        )}
      </div>
    </div>
  );
}

function ConditionRow({
  condition,
  fields,
  disabled,
  onChange,
  onRemove,
}: {
  condition: RuleCondition;
  fields: FieldOption[];
  disabled: boolean;
  onChange: (next: RuleCondition) => void;
  onRemove: () => void;
}) {
  const field = fields.find(option => option.value === condition.field) ?? {
    value: condition.field,
    title: condition.field,
    type: 'text' as const,
  };
  const fieldOptions = fields.some(option => option.value === condition.field) ? fields : [...fields, field];
  const operators = operatorsFor(field.type);
  const build = (fieldValue: string, operator: RuleCondition['operator'], text: string): RuleCondition => {
    const type = fieldOptions.find(option => option.value === fieldValue)?.type ?? 'text';
    const value = parseValue(text, operator, type);
    return value === undefined ? { field: fieldValue, operator } : { field: fieldValue, operator, value };
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <PlainSelect
        ariaLabel="Field"
        value={condition.field}
        disabled={disabled}
        options={fieldOptions.map(option => ({ value: option.value, title: option.title }))}
        onChange={next => {
          const type = fieldOptions.find(option => option.value === next)?.type ?? 'text';
          const allowed = operatorsFor(type).map(op => op.value);
          const operator = allowed.includes(condition.operator) ? condition.operator : allowed[0];
          onChange(build(next, operator, type === 'boolean' ? 'true' : valueText(condition)));
        }}
      />
      <PlainSelect
        ariaLabel="Operator"
        value={condition.operator}
        disabled={disabled}
        options={operators.map(op => ({ value: op.value, title: op.title }))}
        onChange={operator =>
          onChange(build(condition.field, operator as RuleCondition['operator'], valueText(condition)))
        }
      />
      {needsValue(condition.operator) &&
        (field.type === 'boolean' ? (
          <PlainSelect
            ariaLabel="Value"
            value={String(condition.value === true)}
            disabled={disabled}
            options={[
              { value: 'true', title: 'yes' },
              { value: 'false', title: 'no' },
            ]}
            onChange={text => onChange(build(condition.field, condition.operator, text))}
          />
        ) : (
          <CommitInput
            ariaLabel="Value"
            placeholder={isListOperator(condition.operator) ? 'values, comma separated' : 'value'}
            value={valueText(condition)}
            disabled={disabled}
            onCommit={text => onChange(build(condition.field, condition.operator, text))}
          />
        ))}
      <Button size="sm" variant="ghost" disabled={disabled} onClick={onRemove}>
        Remove
      </Button>
    </div>
  );
}

function CommitInput({
  ariaLabel,
  placeholder,
  value,
  disabled,
  onCommit,
}: {
  ariaLabel: string;
  placeholder?: string;
  value: string;
  disabled: boolean;
  onCommit: (value: string) => void;
}) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  return (
    <Input
      size="sm"
      aria-label={ariaLabel}
      placeholder={placeholder}
      value={text}
      disabled={disabled}
      onChange={event => setText(event.target.value)}
      onBlur={() => {
        if (text !== value) onCommit(text);
      }}
    />
  );
}

function LabeledInput({
  label,
  placeholder,
  value,
  disabled,
  onCommit,
}: {
  label: string;
  placeholder?: string;
  value: string;
  disabled: boolean;
  onCommit: (value: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <Txt as="span" variant="caption" className="text-muted-foreground">
        {label}
      </Txt>
      <CommitInput ariaLabel={label} placeholder={placeholder} value={value} disabled={disabled} onCommit={onCommit} />
    </label>
  );
}

function LabeledTextarea({
  label,
  value,
  disabled,
  onCommit,
}: {
  label: string;
  value: string;
  disabled: boolean;
  onCommit: (value: string) => void;
}) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  return (
    <label className="flex flex-col gap-1">
      <Txt as="span" variant="caption" className="text-muted-foreground">
        {label}
      </Txt>
      <Textarea
        size="sm"
        aria-label={label}
        value={text}
        disabled={disabled}
        onChange={event => setText(event.target.value)}
        onBlur={() => {
          if (text !== value) onCommit(text);
        }}
      />
    </label>
  );
}

function LabeledSelect({
  label,
  value,
  options,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; title: string }[];
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <Txt as="span" variant="caption" className="text-muted-foreground">
        {label}
      </Txt>
      <PlainSelect ariaLabel={label} value={value} options={options} disabled={disabled} onChange={onChange} />
    </div>
  );
}

function PlainSelect({
  ariaLabel,
  value,
  options,
  disabled,
  onChange,
}: {
  ariaLabel: string;
  value: string;
  options: { value: string; title: string }[];
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  const current = options.find(option => option.value === value);
  return (
    <Select value={value} disabled={disabled} onValueChange={onChange}>
      <SelectTrigger size="sm" aria-label={ariaLabel} className="w-auto">
        <Txt as="span" variant="caption">
          {current?.title ?? value}
        </Txt>
      </SelectTrigger>
      <SelectContent>
        {options.map(option => (
          <SelectItem key={option.value} value={option.value}>
            {option.title}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
