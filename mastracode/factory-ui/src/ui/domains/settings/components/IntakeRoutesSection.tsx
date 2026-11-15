import { DEFAULT_BOARD_ID } from '@mastra/factory/boards/default-board';
import { INTAKE_ROUTE_RULE_FIELDS, routeEventsProblem } from '@mastra/factory/boards/board-events';
import { ruleGroupSchema } from '@mastra/factory/rules/rule-group';
import type { RuleGroup } from '@mastra/factory/rules/rule-group';
import { Badge } from '@mastra/playground-ui/components/Badge';
import { Button } from '@mastra/playground-ui/components/Button';
import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu';
import { Notice } from '@mastra/playground-ui/components/Notice';
import {
  RuleCard,
  RuleCardBody,
  RuleCardDragHandle,
  RuleCardHeader,
  RuleCardOutcome,
  RuleCardStep,
  RuleCardTitle,
  RuleCardTitleInput,
} from '@mastra/playground-ui/components/RuleCard';
import {
  RuleAddButton,
  RuleLine,
  RuleLineContent,
  RuleLineKeyword,
  RuleLines,
} from '@mastra/playground-ui/components/RuleLines';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@mastra/playground-ui/components/Select';
import { Switch } from '@mastra/playground-ui/components/Switch';
import { toast } from '@mastra/playground-ui/components/Toaster';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { cn } from '@mastra/playground-ui/utils/cn';
import { useQueryClient } from '@tanstack/react-query';
import { Fragment, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useLocation } from 'react-router';

import { queryKeys } from '../../../../api/keys';
import type { InstalledBoardInfo, IntakeRouteInfo, IntakeRouteListResponse } from '../../../../api/types';
import { useBoardCatalog } from '../../../../hooks/useBoardCatalog';
import { BoardRequestError } from '../../../../hooks/useBoardEditor';
import { useApiConfig } from '../../../../api/config';
import {
  applyReroute,
  previewReroute,
  useIntakeRoutesQuery,
  useIntakeRouteWrites,
} from '../../../../hooks/useIntakeRoutes';
import { useSourceSuggestions } from '../../../../hooks/useSourceSuggestions';
import type { RouteWrite } from '../../../../hooks/useIntakeRoutes';
import { BoardStageIcon, phaseIconKind } from '../../factory/components/BoardIcons';
import { NEW_CARD_ROUTES_ANCHOR } from '../settingsSections';
import { ConditionRows } from './ConditionRows';
import { describeConditions, intakeRouteFacts } from './conditionFields';
import {
  boardName,
  catchesEveryArrival,
  describeTarget,
  MOVE_EVENTS,
  phaseName,
  phaseOptions,
  placesNewCards,
  reorderWithin,
  sendNewCardsTo,
  triggerLabel,
} from './intakeRoutes';
import { SettingsSubsection } from './SettingsSubsection';
import type { SourceOption } from './sourceSuggestions';
import { useRowDrag } from './useRowDrag';
import { IconArrowDown } from '@mastra/playground-ui/icons/central/IconArrowDown';
import { IconArrowUp } from '@mastra/playground-ui/icons/central/IconArrowUp';
import { IconDotGrid1x3Horizontal } from '@mastra/playground-ui/icons/central/IconDotGrid1x3Horizontal';
import { IconPlusLarge } from '@mastra/playground-ui/icons/central/IconPlusLarge';
import { IconTrashCan } from '@mastra/playground-ui/icons/central/IconTrashCan';

const ROUTE_WHEN_SCHEMA = ruleGroupSchema(INTAKE_ROUTE_RULE_FIELDS);
const STALE_CODES = new Set(['revision_mismatch', 'intake_route_set_mismatch', 'intake_route_not_found']);
const DROP_LINE = cn(
  'before:bg-border-focus before:pointer-events-none before:absolute before:right-0 before:left-0 before:z-20 before:hidden before:h-0.5 before:rounded-full',
  'data-[drop=before]:before:-top-2 data-[drop=before]:before:block data-[drop=after]:before:-bottom-2 data-[drop=after]:before:block',
);

const json = (rule: RuleGroup | null | undefined) => JSON.stringify(rule ?? null);

/**
 * Which routes a list shows. New-card routes are one ordered list for the whole Factory; every other route
 * only moves cards already on its own board, so each board lists its own.
 */
type RouteScope = { kind: 'arrivals' } | { kind: 'moves'; board: InstalledBoardInfo };

type RouteFields = Partial<Pick<IntakeRouteInfo, 'name' | 'enabled' | 'when' | 'on' | 'target'>>;
type NewRouteValue = Pick<IntakeRouteInfo, 'name' | 'on' | 'when' | 'target'>;

function inScope(route: IntakeRouteInfo, scope: RouteScope): boolean {
  if (scope.kind === 'arrivals') return placesNewCards(route);
  return !placesNewCards(route) && route.target.boardKey === scope.board.id;
}

/**
 * Phases a route may aim at. New cards can't land in a finished phase, and start in the first phase, so they can
 * only land where it can move them. A pull request joining its issue's card moves that card, so only the first rule
 * holds there.
 */
function targetPhases(board: InstalledBoardInfo | undefined, placesNew: boolean, joining: boolean) {
  const phases = board?.phases ?? [];
  if (!placesNew) return phases;
  if (joining) return phases.filter(phase => phase.kind !== 'terminal');
  const first = phases.find(phase => phase.id === board?.initialPhase);
  return phases.filter(
    phase =>
      phase.kind !== 'terminal' &&
      (phase.id === first?.id || first?.transitions.some(transition => transition.to === phase.id) === true),
  );
}

/** What a rule can't say on a route listening for these events, or undefined when the route can save it. */
function whenProblem(on: IntakeRouteInfo['on'], when: RuleGroup | null): string | undefined {
  if (when) {
    const parsed = ROUTE_WHEN_SCHEMA.safeParse(when);
    if (!parsed.success) return parsed.error.issues[0]?.message;
  }
  return routeEventsProblem(on, when) ?? undefined;
}

/** The values a change replaces, so Undo can put them back. */
function previousOf(route: IntakeRouteInfo, fields: RouteFields): RouteFields {
  const previous: RouteFields = {};
  if (fields.name !== undefined) previous.name = route.name;
  if (fields.enabled !== undefined) previous.enabled = route.enabled;
  if (fields.when !== undefined) previous.when = route.when;
  if (fields.on !== undefined) previous.on = route.on;
  if (fields.target !== undefined) previous.target = route.target;
  return previous;
}

function updateMessage(fields: RouteFields): string {
  if (fields.enabled !== undefined) return fields.enabled ? 'Route turned on' : 'Route turned off';
  if (fields.name !== undefined) return 'Route renamed';
  if (fields.on !== undefined) return 'Trigger changed';
  if (fields.target !== undefined) return 'Destination changed';
  return 'Conditions saved';
}

function saveFailureMessage(error: unknown): string {
  if (error instanceof BoardRequestError && STALE_CODES.has(error.code ?? '')) {
    return 'Someone else changed these routes first, so your change wasn’t saved.';
  }
  return error instanceof Error ? error.message : 'The routes were not saved.';
}

function stepLabel(index: number, catchAllAt: number): string {
  if (index === catchAllAt) return 'Otherwise';
  return index === 0 ? 'If' : 'Else if';
}

function destinationLabelFor(scope: RouteScope, joining: boolean): string {
  if (scope.kind === 'moves') return 'Move to';
  return joining ? 'Join the issue’s card, move to' : 'Send to';
}

/**
 * Whether a route can join a pull request to the card of the issue it closes: it handles arrivals alone, and
 * every card it matches is a pull request that closes an issue.
 */
function canJoinIssueCard(on: IntakeRouteInfo['on'], when: RuleGroup | null): boolean {
  if (on.length !== 1 || on[0] !== 'work_item.created' || when?.operator !== 'AND') return false;
  const requires = (field: string, value: unknown) =>
    when.conditions.some(
      condition =>
        !('conditions' in condition) &&
        condition.field === field &&
        condition.operator === 'equals' &&
        condition.value === value,
    );
  return requires('source.kind', 'pull_request') && requires('pullRequest.closesIssue', true);
}

/** The phase a route keeps when what it does with cards changes: its own if cards can still be there. */
function phaseStillOffered(board: InstalledBoardInfo | undefined, phaseKey: string, joining: boolean): string {
  if (targetPhases(board, true, joining).some(phase => phase.id === phaseKey)) return phaseKey;
  return board?.initialPhase ?? phaseKey;
}

function JoinIssueCard({ checked, onChange }: { checked: boolean; onChange: (joining: boolean) => void }) {
  return (
    <div className="flex items-start gap-2 pr-2 pl-4">
      <Switch aria-label="Join the issue’s card instead" checked={checked} onCheckedChange={onChange} />
      <div className="flex min-w-0 flex-col">
        <Txt as="span" variant="caption">
          Join the issue’s card instead
        </Txt>
        <Txt as="span" variant="caption" tone="muted">
          Only trusted authors’ pull requests join; others get their own card.
        </Txt>
      </div>
    </div>
  );
}

/**
 * Saves route changes one after another, each built from the routes as they are when its turn comes, so a
 * write always names the revision it last saw. Changes show at once; a failed one reloads the routes.
 */
function useRouteSaves(factoryId: string) {
  const queryClient = useQueryClient();
  const { baseUrl } = useApiConfig();
  const writes = useIntakeRouteWrites(factoryId);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const previews = useRef(0);
  const [failures, setFailures] = useState(0);
  const key = queryKeys.intakeRoutes(factoryId);

  const latest = () => queryClient.getQueryData<IntakeRouteListResponse>(key)?.intakeRoutes ?? [];
  const show = (change: (routes: IntakeRouteInfo[]) => IntakeRouteInfo[]) =>
    queryClient.setQueryData<IntakeRouteListResponse>(key, data =>
      data ? { ...data, intakeRoutes: change(data.intakeRoutes) } : data,
    );
  /** Queues `task` after the earlier saves; resolves to whether it went through. */
  const save = (task: (send: (changes: RouteWrite[]) => Promise<IntakeRouteInfo[]>) => Promise<void>) => {
    const done = queue.current
      .then(() => task(changes => writes.mutateAsync(changes)))
      .then(
        () => true,
        async (error: unknown) => {
          setFailures(count => count + 1);
          toast.error(saveFailureMessage(error));
          await queryClient.invalidateQueries({ queryKey: key });
          return false;
        },
      );
    queue.current = done.then(() => undefined);
    void done.then(saved => {
      if (saved) void warnOfReroute();
    });
    return done;
  };
  /** The routes now file some untouched cards elsewhere: warn, and offer to move them. */
  const warnOfReroute = async () => {
    const asked = ++previews.current;
    const preview = await previewReroute(baseUrl, factoryId).catch(() => undefined);
    // A later save asked again; only its answer describes the routes as they are now.
    if (asked !== previews.current || !preview) return;
    if (preview.total === 0) {
      toast.dismiss(`reroute-${factoryId}`);
      return;
    }
    const where = preview.moves.map(move => `${move.count} from ${move.fromBoard} to ${move.toBoard}`).join(', ');
    toast.warning(
      `${preview.total} untouched card${preview.total === 1 ? '' : 's'} now match${preview.total === 1 ? 'es' : ''} another board (${where}).`,
      {
        id: `reroute-${factoryId}`,
        duration: Infinity,
        action: {
          label: 'Move',
          onClick: () =>
            void applyReroute(baseUrl, factoryId).then(
              ({ moved, skipped }) => {
                const movedText = `Moved ${moved} card${moved === 1 ? '' : 's'} to the start of their new board.`;
                if (skipped > 0) {
                  toast.warning(
                    `${movedText} ${skipped} card${skipped === 1 ? ' was' : 's were'} skipped because ${skipped === 1 ? 'it' : 'they'} changed in the meantime.`,
                  );
                } else {
                  toast.success(movedText);
                }
                void queryClient.invalidateQueries();
              },
              (error: unknown) => toast.error(saveFailureMessage(error)),
            ),
        },
      },
    );
  };
  return { latest, show, save, failures };
}

/** The routes changed under a queued edit, so it can't be applied as shown. */
const routesChanged = () => new BoardRequestError(409, 'intake_route_set_mismatch', 'The routes changed.');

function announce(id: string, message: string, undo?: () => void) {
  toast(message, { id: `route-${id}`, ...(undo ? { action: { label: 'Undo', onClick: undo } } : {}) });
}

/** Read-only conditions, as a member sees them. */
function ConditionChips({
  route,
  board,
  fallback,
}: {
  route: IntakeRouteInfo;
  board?: InstalledBoardInfo;
  fallback: string;
}) {
  const conditions = describeConditions(route.when, phaseOptions(board));
  if (!conditions) {
    return (
      <Txt as="span" variant="caption" tone="muted">
        {fallback}
      </Txt>
    );
  }
  return conditions.parts.map((part, index) => (
    <Fragment key={index}>
      {index > 0 && conditions.join === 'or' && (
        <Txt as="span" variant="caption" tone="muted">
          or
        </Txt>
      )}
      <Badge size="sm" emphasis="subtle">
        {part}
      </Badge>
    </Fragment>
  ));
}

function BoardPicker({
  value,
  boards,
  label,
  onChange,
}: {
  value: string;
  boards: InstalledBoardInfo[];
  label: string;
  onChange: (boardKey: string) => void;
}) {
  const board = boards.find(candidate => candidate.id === value);
  return (
    <Select value={value} onValueChange={key => key && key !== value && onChange(key)}>
      <SelectTrigger variant="ghost" size="sm" aria-label={label} className="w-fit">
        <Txt as="span" variant="caption">
          {board ? boardName(board) : `${value} (not installed)`}
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
  );
}

function PhaseLabel({ board, phaseKey }: { board: InstalledBoardInfo; phaseKey: string }) {
  const phase = board.phases.find(candidate => candidate.id === phaseKey);
  return (
    <span className="flex items-center gap-1.5">
      {phase && <BoardStageIcon stage={phase.id} kind={phaseIconKind(board.id, phase.kind)} decorative />}
      <Txt as="span" variant="caption">
        {phaseName(board, phaseKey) ?? phaseKey}
      </Txt>
    </span>
  );
}

function PhasePicker({
  board,
  value,
  placesNew,
  joining = false,
  label,
  onChange,
}: {
  board: InstalledBoardInfo;
  value: string;
  placesNew: boolean;
  /** The route joins a pull request to its issue's card, which already sits on the board. */
  joining?: boolean;
  label: string;
  onChange: (phaseKey: string) => void;
}) {
  return (
    <Select value={value} onValueChange={key => key && key !== value && onChange(key)}>
      <SelectTrigger variant="ghost" size="sm" aria-label={label} className="w-fit">
        <PhaseLabel board={board} phaseKey={value} />
      </SelectTrigger>
      <SelectContent>
        {targetPhases(board, placesNew, joining).map(phase => (
          <SelectItem key={phase.id} value={phase.id}>
            <PhaseLabel board={board} phaseKey={phase.id} />
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function EventPicker({
  value,
  onChange,
}: {
  value: IntakeRouteInfo['on'];
  onChange: (on: IntakeRouteInfo['on']) => void;
}) {
  return (
    <Select
      value={value.length === 1 ? value[0] : null}
      onValueChange={event => event && !(value.length === 1 && value[0] === event) && onChange([event])}
    >
      <SelectTrigger size="sm" aria-label="When" className="w-fit">
        <Txt as="span" variant="caption" className="font-medium">
          {triggerLabel(value)}
        </Txt>
      </SelectTrigger>
      <SelectContent>
        {MOVE_EVENTS.map(event => (
          <SelectItem key={event} value={event}>
            {triggerLabel([event])}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** A route's name, edited in place: Enter or leaving the field saves it, Escape puts it back. */
function RouteName({ name, onRename }: { name: string; onRename: (name: string) => void }) {
  // What is being typed, until it is saved or put back; the saved name shows otherwise.
  const [draft, setDraft] = useState<string>();
  const commit = () => {
    if (draft === undefined) return;
    setDraft(undefined);
    const next = draft.trim();
    if (next && next !== name) onRename(next);
  };
  return (
    <RuleCardTitleInput
      aria-label="Route name"
      value={draft ?? name}
      maxLength={120}
      onChange={event => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={event => {
        if (event.key === 'Enter') event.currentTarget.blur();
        if (event.key === 'Escape') setDraft(undefined);
      }}
    />
  );
}

/** A route's conditions, saved as soon as they are whole and valid. */
function RouteConditions({
  route,
  board,
  sources,
  readOnly,
  needsOne,
  onSave,
}: {
  route: IntakeRouteInfo;
  board: InstalledBoardInfo | undefined;
  /** The project's repositories, teams and projects, offered for `source.repository`. */
  sources: SourceOption[];
  readOnly: boolean;
  /** A new-card route with no conditions would take every new card, hiding the routes below it. */
  needsOne: boolean;
  onSave: (when: RuleGroup | null) => void;
}) {
  const [problem, setProblem] = useState<string>();
  // The rows keep their own unfinished edits, so they only start over when the saved conditions change to
  // something these rows didn't write: an Undo, or another admin's edit.
  const [seen, setSeen] = useState(() => json(route.when));
  const [written, setWritten] = useState(seen);
  const [resets, setResets] = useState(0);
  if (json(route.when) !== seen) {
    setSeen(json(route.when));
    if (json(route.when) !== written) {
      setWritten(json(route.when));
      setResets(resets + 1);
      setProblem(undefined);
    }
  }
  if (readOnly) {
    return (
      <RuleLines>
        <RuleLine>
          <RuleLineKeyword>Where</RuleLineKeyword>
          <RuleLineContent>
            <ConditionChips route={route} board={board} fallback="every card" />
          </RuleLineContent>
        </RuleLine>
      </RuleLines>
    );
  }
  return (
    <div className="flex flex-col gap-1.5">
      <ConditionRows
        key={resets}
        label={`${route.name} conditions`}
        rule={route.when}
        facts={intakeRouteFacts(route.on)}
        options={{ ...phaseOptions(board), 'source.repository': sources }}
        emptyHint={needsOne ? 'Add at least one.' : 'Matches every card.'}
        onChange={(when, incomplete) => {
          // An empty new-card route isn't saved, and the empty rows already say why.
          if (incomplete || (needsOne && when === null)) return setProblem(undefined);
          const next = whenProblem(route.on, when);
          setProblem(next);
          if (next || json(when) === json(route.when)) return;
          setWritten(json(when));
          onSave(when);
        }}
      />
      {problem && (
        <Txt as="p" variant="caption" className="text-destructive-foreground" role="alert">
          {problem}
        </Txt>
      )}
    </div>
  );
}

function RouteCard({
  route,
  scope,
  boards,
  sources,
  readOnly,
  isCatchAll,
  unreachable,
  step,
  grip,
  canMoveUp,
  canMoveDown,
  onUpdate,
  onRemove,
  onMove,
  onSendTo,
}: {
  route: IntakeRouteInfo;
  scope: RouteScope;
  boards: InstalledBoardInfo[];
  sources: SourceOption[];
  readOnly: boolean;
  isCatchAll: boolean;
  unreachable: boolean;
  step?: string;
  /** The drag handle, in the header's inset just before the route's step or name. */
  grip?: ReactNode;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onUpdate: (fields: RouteFields) => void;
  onRemove: () => void;
  onMove: (offset: -1 | 1) => void;
  onSendTo: (boardKey: string) => void;
}) {
  const board = boards.find(candidate => candidate.id === route.target.boardKey);
  const phaseKey = route.target.phaseKey ?? board?.initialPhase ?? '';
  const placesNew = placesNewCards(route);
  const setTarget = (target: Partial<IntakeRouteInfo['target']>) =>
    onUpdate({ target: { ...route.target, ...target } });

  const joining = route.target.joinClosedIssue === true;
  const destinationLabel = destinationLabelFor(scope, joining);
  // A route already joining keeps the switch whatever its conditions say now, so it can be turned off.
  const offersJoin =
    scope.kind === 'arrivals' && !readOnly && !isCatchAll && (joining || canJoinIssueCard(route.on, route.when));

  return (
    <RuleCard inactive={!route.enabled}>
      <RuleCardHeader>
        {grip}
        {step && <RuleCardStep>{step}</RuleCardStep>}
        {readOnly ? (
          <RuleCardTitle>{route.name}</RuleCardTitle>
        ) : (
          <RouteName name={route.name} onRename={name => onUpdate({ name })} />
        )}
        <Switch
          aria-label={`Use ${route.name}`}
          checked={route.enabled}
          disabled={readOnly}
          onCheckedChange={enabled => onUpdate({ enabled })}
        />
        {!readOnly && (
          <DropdownMenu>
            <DropdownMenu.Trigger
              render={
                <Button variant="ghost" size="icon-sm" aria-label={`${route.name} actions`}>
                  <IconDotGrid1x3Horizontal />
                </Button>
              }
            />
            <DropdownMenu.Content align="end">
              <DropdownMenu.Item disabled={!canMoveUp} onClick={() => onMove(-1)}>
                <IconArrowUp /> Move up
              </DropdownMenu.Item>
              <DropdownMenu.Item disabled={!canMoveDown} onClick={() => onMove(1)}>
                <IconArrowDown /> Move down
              </DropdownMenu.Item>
              <DropdownMenu.Separator />
              <DropdownMenu.Item variant="destructive" onClick={onRemove}>
                <IconTrashCan /> Delete
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu>
        )}
      </RuleCardHeader>
      {(scope.kind === 'moves' || !isCatchAll) && (
        <RuleCardBody>
          {scope.kind === 'moves' && (
            <RuleLine>
              <RuleLineKeyword>When</RuleLineKeyword>
              <RuleLineContent>
                {readOnly ? (
                  <Badge size="sm">{triggerLabel(route.on)}</Badge>
                ) : (
                  <EventPicker value={route.on} onChange={on => onUpdate({ on })} />
                )}
              </RuleLineContent>
            </RuleLine>
          )}
          <RouteConditions
            key={route.on.join()}
            route={route}
            board={board}
            sources={sources}
            readOnly={readOnly}
            needsOne={scope.kind === 'arrivals'}
            onSave={when => onUpdate({ when })}
          />
        </RuleCardBody>
      )}
      {offersJoin && (
        <JoinIssueCard
          checked={joining}
          onChange={next => setTarget({ joinClosedIssue: next, phaseKey: phaseStillOffered(board, phaseKey, next) })}
        />
      )}
      <RuleCardOutcome label={destinationLabel}>
        {readOnly ? (
          <Badge size="sm">
            {scope.kind === 'moves' && board ? (phaseName(board, phaseKey) ?? phaseKey) : describeTarget(route, boards)}
          </Badge>
        ) : (
          <>
            {scope.kind === 'arrivals' && (
              <>
                <BoardPicker
                  value={route.target.boardKey}
                  boards={boards}
                  label={isCatchAll ? 'Board for new cards' : 'Board'}
                  onChange={boardKey => {
                    if (isCatchAll) return onSendTo(boardKey);
                    const next = boards.find(candidate => candidate.id === boardKey);
                    if (next) setTarget({ boardKey, phaseKey: next.initialPhase });
                  }}
                />
                {board && (
                  <Txt as="span" variant="caption" tone="muted" aria-hidden>
                    ›
                  </Txt>
                )}
              </>
            )}
            {board && (
              <PhasePicker
                board={board}
                value={phaseKey}
                placesNew={placesNew}
                joining={joining}
                label={scope.kind === 'moves' ? 'Move to' : 'Phase'}
                onChange={next => setTarget({ phaseKey: next })}
              />
            )}
          </>
        )}
      </RuleCardOutcome>
      {unreachable && (
        <Txt as="p" variant="caption" tone="muted" className="pl-4">
          Never runs: a route above takes every new card.
        </Txt>
      )}
      {route.problems.map(problem => (
        <Notice key={problem} variant="warning">
          {problem}
        </Notice>
      ))}
    </RuleCard>
  );
}

/** A route being written: nothing is saved until it has a name, a destination and finished conditions. */
function NewRoute({
  scope,
  boards,
  sources,
  initialBoard,
  onAdd,
  onCancel,
}: {
  scope: RouteScope;
  boards: InstalledBoardInfo[];
  sources: SourceOption[];
  initialBoard: InstalledBoardInfo | undefined;
  /** Resolves to whether the route was added. */
  onAdd: (route: NewRouteValue) => Promise<boolean>;
  onCancel: () => void;
}) {
  const [name, setName] = useState('');
  const [on, setOn] = useState<IntakeRouteInfo['on']>(
    scope.kind === 'moves' ? ['work_item.closed'] : ['work_item.created'],
  );
  const [when, setWhen] = useState<RuleGroup | null>(null);
  const [incomplete, setIncomplete] = useState(false);
  const [boardKey, setBoardKey] = useState(initialBoard?.id ?? '');
  const board = boards.find(candidate => candidate.id === boardKey);
  const [phaseKey, setPhaseKey] = useState(
    scope.kind === 'moves'
      ? (scope.board.flow?.completed ?? scope.board.initialPhase)
      : (initialBoard?.initialPhase ?? ''),
  );
  const [wantsJoin, setWantsJoin] = useState(false);
  const offersJoin = scope.kind === 'arrivals' && canJoinIssueCard(on, when);
  const joining = offersJoin && wantsJoin;
  // Leaving joining can leave a phase new cards can't land in picked.
  const targetPhase = scope.kind === 'arrivals' ? phaseStillOffered(board, phaseKey, joining) : phaseKey;
  const problem = whenProblem(on, when);
  const needsCondition = scope.kind === 'arrivals' && when === null;
  const [adding, setAdding] = useState(false);
  const ready =
    !adding &&
    name.trim() !== '' &&
    board !== undefined &&
    targetPhase !== '' &&
    !incomplete &&
    !problem &&
    !needsCondition;
  const label = scope.kind === 'moves' ? 'Add card move' : 'Add route';

  return (
    <RuleCard>
      <RuleCardHeader>
        <RuleCardStep>New</RuleCardStep>
        <RuleCardTitleInput
          aria-label="New route name"
          placeholder={scope.kind === 'moves' ? 'Name this card move' : 'Name this route'}
          autoFocus
          value={name}
          maxLength={120}
          onChange={event => setName(event.target.value)}
        />
      </RuleCardHeader>
      <RuleCardBody>
        {scope.kind === 'moves' && (
          <RuleLine>
            <RuleLineKeyword>When</RuleLineKeyword>
            <RuleLineContent>
              <EventPicker value={on} onChange={setOn} />
            </RuleLineContent>
          </RuleLine>
        )}
        <ConditionRows
          label="New route conditions"
          rule={when}
          facts={intakeRouteFacts(on)}
          options={{ ...phaseOptions(board), 'source.repository': sources }}
          emptyHint={needsCondition ? 'Add at least one.' : 'Matches every card.'}
          onChange={(next, unfinished) => {
            setWhen(next);
            setIncomplete(unfinished);
          }}
        />
        {problem && !incomplete && (
          <Txt as="p" variant="caption" className="text-destructive-foreground" role="alert">
            {problem}
          </Txt>
        )}
      </RuleCardBody>
      {offersJoin && <JoinIssueCard checked={wantsJoin} onChange={setWantsJoin} />}
      <RuleCardOutcome label={destinationLabelFor(scope, joining)}>
        {scope.kind === 'arrivals' && (
          <>
            <BoardPicker
              value={boardKey}
              boards={boards}
              label="Board"
              onChange={key => {
                setBoardKey(key);
                setPhaseKey(boards.find(candidate => candidate.id === key)?.initialPhase ?? '');
              }}
            />
            <Txt as="span" variant="caption" tone="muted" aria-hidden>
              ›
            </Txt>
          </>
        )}
        {board && (
          <PhasePicker
            board={board}
            value={targetPhase}
            placesNew={scope.kind === 'arrivals'}
            joining={joining}
            label={scope.kind === 'moves' ? 'Move to' : 'Phase'}
            onChange={setPhaseKey}
          />
        )}
        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={!ready}
            onClick={async () => {
              if (!board) return;
              setAdding(true);
              const added = await onAdd({
                name: name.trim(),
                on,
                when,
                target: { boardKey: board.id, phaseKey: targetPhase, joinClosedIssue: joining },
              });
              // An added route closes this form; a failed one leaves it to try again.
              if (!added) setAdding(false);
            }}
          >
            {label}
          </Button>
        </div>
      </RuleCardOutcome>
    </RuleCard>
  );
}

/**
 * One scope's routes in the order they are tried, edited in place. The project keeps one ordered list; this
 * shows the scope's share of it, and moving a route only trades places within that share.
 */
function RouteList({
  factoryId,
  scope,
  boards,
  noun,
}: {
  factoryId: string;
  scope: RouteScope;
  boards: InstalledBoardInfo[];
  /** What the list calls its routes: "intake routes", "card moves". */
  noun: string;
}) {
  const query = useIntakeRoutesQuery(factoryId);
  const sources = useSourceSuggestions(factoryId);
  const { latest, show, save, failures } = useRouteSaves(factoryId);
  const [adding, setAdding] = useState(false);
  const routes = (query.data?.intakeRoutes ?? []).filter(route => inScope(route, scope));
  const readOnly = !(query.data?.canEdit ?? false);
  const defaultBoard = boards.find(board => board.id === DEFAULT_BOARD_ID) ?? boards[0];
  // Routes apply in order, so the first route taking every new card is the one that places them.
  const catchAll = scope.kind === 'arrivals' ? routes.find(catchesEveryArrival) : undefined;
  const catchAllAt = catchAll ? routes.indexOf(catchAll) : -1;
  // Routes after the catch-all never run, and the catch-all itself stays last.
  const lastMovable = catchAllAt >= 0 ? catchAllAt - 1 : routes.length - 1;
  // With no route taking every new card, the leftovers land on the default board's first phase.
  const fallback = scope.kind === 'arrivals' && !catchAll ? defaultBoard : undefined;

  const update = (route: IntakeRouteInfo, fields: RouteFields, message = updateMessage(fields), undoable = true) => {
    const previous = previousOf(route, fields);
    const apply = () => show(all => all.map(entry => (entry.id === route.id ? { ...entry, ...fields } : entry)));
    apply();
    save(async send => {
      const revision = latest().find(entry => entry.id === route.id)?.revision;
      if (revision === undefined) throw routesChanged();
      apply();
      await send([{ kind: 'update', id: route.id, patch: { ...fields, expectedRevision: revision } }]);
      announce(route.id, message, undoable ? () => update(route, previous, 'Change undone', false) : undefined);
    });
  };

  const reorder = (order: string[], message: string, undo?: string[]) => {
    const apply = () => show(all => order.flatMap(id => all.filter(entry => entry.id === id)));
    apply();
    save(async send => {
      const current = latest();
      if (current.length !== order.length || current.some(entry => !order.includes(entry.id))) throw routesChanged();
      apply();
      await send([{ kind: 'reorder', ids: order }]);
      announce('order', message, undo ? () => reorder(undo, 'Order restored') : undefined);
    });
  };

  const move = (from: number, to: number) => {
    const route = routes[from];
    if (!route || to < 0 || to >= routes.length) return;
    const all = latest();
    const order = reorderWithin(
      all,
      routes.map(entry => entry.id),
      from,
      to,
    );
    reorder(
      order,
      `Moved ${route.name} to position ${to + 1}`,
      all.map(entry => entry.id),
    );
  };

  const remove = (route: IntakeRouteInfo) => {
    const order = latest().map(entry => entry.id);
    const hide = () => show(all => all.filter(entry => entry.id !== route.id));
    hide();
    save(async send => {
      const revision = latest().find(entry => entry.id === route.id)?.revision ?? route.revision;
      hide();
      await send([{ kind: 'delete', id: route.id, expectedRevision: revision }]);
      announce(route.id, `Deleted ${route.name}`, () => restore(route, order));
    });
  };

  const restore = (route: IntakeRouteInfo, order: string[]) =>
    save(async send => {
      const [created] = await send([
        {
          kind: 'create',
          route: { name: route.name, enabled: route.enabled, when: route.when, on: route.on, target: route.target },
        },
      ]);
      if (!created) return;
      const ids = latest().map(entry => entry.id);
      const back = order.map(id => (id === route.id ? created.id : id)).filter(id => ids.includes(id));
      await send([{ kind: 'reorder', ids: [...back, ...ids.filter(id => !back.includes(id))] }]);
      announce(route.id, `Restored ${route.name}`);
    });

  const sendTo = (boardKey: string) =>
    save(async send => {
      const before = latest().find(catchesEveryArrival);
      const created = await send(sendNewCardsTo(latest(), boards, boardKey));
      const board = boards.find(candidate => candidate.id === boardKey);
      announce('catch-all', `New cards no route takes now go to ${board ? boardName(board) : boardKey}`, () =>
        unsendTo(before, created),
      );
    });

  /**
   * Points the catch-all back where it was and deletes the routes sending new cards elsewhere
   * created. Deleting a route renumbers every route below it, so the copies go last-first: removing
   * the lowest one moves nothing, and the revisions read up front stay current.
   */
  const unsendTo = (before: IntakeRouteInfo | undefined, created: IntakeRouteInfo[]) =>
    save(async send => {
      const current = latest();
      const revisionOf = (route: IntakeRouteInfo) =>
        current.find(entry => entry.id === route.id)?.revision ?? route.revision;
      const positionOf = (route: IntakeRouteInfo) => current.findIndex(entry => entry.id === route.id);
      const lastFirst = created.toSorted((a, b) => positionOf(b) - positionOf(a));
      await send([
        ...(before
          ? [
              {
                kind: 'update' as const,
                id: before.id,
                patch: { name: before.name, target: before.target, expectedRevision: revisionOf(before) },
              },
            ]
          : []),
        ...lastFirst.map(route => ({ kind: 'delete' as const, id: route.id, expectedRevision: revisionOf(route) })),
      ]);
      announce('catch-all', 'Change undone');
    });

  const add = (route: NewRouteValue) =>
    save(async send => {
      const [created] = await send([
        {
          kind: 'create',
          route: {
            name: route.name,
            when: route.when,
            ...(scope.kind === 'moves' ? { on: route.on } : {}),
            target: {
              boardKey: route.target.boardKey,
              phaseKey: route.target.phaseKey,
              ...(route.target.joinClosedIssue ? { joinClosedIssue: true } : {}),
            },
          },
        },
      ]);
      setAdding(false);
      announce('new', `Added ${route.name}`, created ? () => remove(created) : undefined);
    });

  const drag = useRowDrag({
    min: 0,
    max: Math.max(lastMovable, 0),
    onDrop: move,
  });

  if (query.isPending) {
    return (
      <Txt tone="muted" as="p" variant="caption" role="status">
        Loading {noun}…
      </Txt>
    );
  }
  if (query.error) return <Notice variant="destructive">{query.error.message}</Notice>;

  const arrivals = scope.kind === 'arrivals';

  return (
    <div className="flex flex-col gap-4">
      {readOnly && <Notice variant="info">Only organization admins can change {noun}.</Notice>}
      {routes.length === 0 && scope.kind === 'moves' && !adding && (
        <Txt as="p" variant="caption" tone="muted">
          No card moves on this board.
        </Txt>
      )}
      {(routes.length > 0 || fallback) && (
        <ol className="flex flex-col gap-5" aria-label={noun.charAt(0).toUpperCase() + noun.slice(1)}>
          {routes.map((route, index) => {
            const sortable = !readOnly && index <= lastMovable && lastMovable > 0;
            const dragging = drag.drag?.from === index;
            return (
              <li
                // A failed save remounts the cards so their name and condition editors drop the rejected input.
                key={`${route.id}-${failures}`}
                data-drop={drag.dropAt(index)}
                className={cn('relative', DROP_LINE, dragging && 'z-10')}
                style={dragging ? { transform: `translateY(${drag.drag?.offset ?? 0}px)` } : undefined}
                onPointerDown={sortable ? event => drag.onPointerDown(event, index) : undefined}
              >
                <RouteCard
                  route={route}
                  scope={scope}
                  boards={boards}
                  sources={sources}
                  readOnly={readOnly}
                  isCatchAll={index === catchAllAt}
                  unreachable={catchAllAt >= 0 && index > catchAllAt}
                  step={arrivals ? stepLabel(index, catchAllAt) : undefined}
                  grip={
                    sortable && (
                      <RuleCardDragHandle
                        data-grip
                        aria-label={`Reorder ${route.name}`}
                        onKeyDown={event => drag.onKeyDown(event, index)}
                      />
                    )
                  }
                  canMoveUp={!readOnly && index > 0 && index !== catchAllAt}
                  canMoveDown={!readOnly && index < lastMovable}
                  onUpdate={fields => update(route, fields)}
                  onRemove={() => remove(route)}
                  onMove={offset => move(index, index + offset)}
                  onSendTo={sendTo}
                />
              </li>
            );
          })}
          {fallback && (
            <li className="flex flex-wrap items-center gap-2 pl-4">
              <RuleCardStep>Otherwise</RuleCardStep>
              <Txt as="span" variant="caption" tone="muted">
                Everything else goes to
              </Txt>
              {readOnly ? (
                <Badge size="sm">
                  {boardName(fallback)} › {phaseName(fallback, fallback.initialPhase) ?? fallback.initialPhase}
                </Badge>
              ) : (
                <>
                  <BoardPicker value={fallback.id} boards={boards} label="Board for new cards" onChange={sendTo} />
                  <Txt as="span" variant="caption" tone="muted" aria-hidden>
                    ›
                  </Txt>
                  <PhaseLabel board={fallback} phaseKey={fallback.initialPhase} />
                </>
              )}
            </li>
          )}
        </ol>
      )}
      {!readOnly &&
        (adding ? (
          <div role="group" aria-label={scope.kind === 'moves' ? 'New card move' : 'New route'}>
            <NewRoute
              scope={scope}
              boards={boards}
              sources={sources}
              initialBoard={scope.kind === 'moves' ? scope.board : defaultBoard}
              onAdd={add}
              onCancel={() => setAdding(false)}
            />
          </div>
        ) : (
          <div className="pl-4">
            <RuleAddButton icon={<IconPlusLarge />} onClick={() => setAdding(true)}>
              {scope.kind === 'moves' ? 'Add card move' : 'Add route'}
            </RuleAddButton>
          </div>
        ))}
    </div>
  );
}

/** Where new cards land: one ordered list for the whole Factory, tried top to bottom; the first match wins. */
export function IntakeRoutesSection({ factoryId }: { factoryId?: string }) {
  const boards = useBoardCatalog(factoryId).data ?? [];
  const { hash, key } = useLocation();
  const anchorRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (hash === `#${NEW_CARD_ROUTES_ANCHOR}`) anchorRef.current?.scrollIntoView({ block: 'start' });
  }, [hash, key]);
  return (
    <SettingsSubsection
      ref={anchorRef}
      id={NEW_CARD_ROUTES_ANCHOR}
      scope="factory"
      title="Where new cards go"
      description="Each new issue or pull request takes the first route that matches."
    >
      {factoryId ? (
        <RouteList factoryId={factoryId} scope={{ kind: 'arrivals' }} boards={boards} noun="intake routes" />
      ) : (
        <Notice variant="info">Open a Factory to edit its intake routes.</Notice>
      )}
    </SettingsSubsection>
  );
}

/** How cards already on one board move when their issue or pull request changes. */
export function CardMovesSection({ factoryId, boardId }: { factoryId: string; boardId: string }) {
  const catalog = useBoardCatalog(factoryId);
  const boards = catalog.data ?? [];
  const board = boards.find(candidate => candidate.id === boardId);
  if (catalog.isPending) {
    return (
      <Txt tone="muted" as="p" variant="caption" role="status">
        Loading card moves…
      </Txt>
    );
  }
  if (!board) return <Notice variant="destructive">This board isn’t installed.</Notice>;
  return <RouteList factoryId={factoryId} scope={{ kind: 'moves', board }} boards={boards} noun="card moves" />;
}
