import type {
  InstalledBoardInfo,
  IntakeOrderResponse,
  IntakeRouteInfo,
  IntakeSkippedResponse,
  IntakeTestResponse,
  StoredPhaseInfo,
} from '../../../api/types';
import { boardFlow } from '../boardRules/boardFlow';
import {
  arrivalFallback,
  catchAllIndex,
  everythingOn,
  isLegacyOpened,
  isOpenedLane,
  LANE_SECTIONS,
  laneRules,
  laneText,
  movesCardsOnly,
  shadowedBy,
  skipsOutsidersOn,
} from '../boardRules/ruleLanes';
import type { RuleEvent } from '../boardRules/ruleLanes';
import { defaultOutcomes, DEFAULT_SESSION, exitToolOutcome, nextPhasesOf } from '../boardConfig/boardDraft';

export type RuleSkips = IntakeSkippedResponse['skipped'][number];
export type BoardFlowParts = NonNullable<InstalledBoardInfo['flow']>;
type IntakeOrderBoard = IntakeOrderResponse['boards'][number];
type Evaluator = IntakeOrderResponse['evaluator'];

/** Triggers new items arrive on come first, so the intake line plugs into the top of a phase's rules. */
const LANE_ORDER = LANE_SECTIONS.flatMap(section => section.events);

/** One rule on one of its triggers: a rule listening on two triggers shows twice, with its place on each. */
export interface RuleLine {
  rule: IntakeRouteInfo;
  event: RuleEvent;
  /** Its place on the trigger, from 1: the first rule that matches wins. */
  rank: number;
  /** How many of this board's rules listen on the trigger. */
  of: number;
  label: string;
  /** Items it filed in the last 30 days; only rules that file new items count them. */
  filed: number | undefined;
  /** The place of the rule above that takes everything first, so this one never runs. */
  hiddenBy: number | undefined;
  skipsOutsiders: boolean;
  movesCardsOnly: boolean;
  skips: RuleSkips | undefined;
}

export interface PhaseRow {
  phase: StoredPhaseInfo;
  lines: RuleLine[];
  /** Other boards' rules that move their cards into this phase. */
  incoming: IntakeRouteInfo[];
  /** Not the first phase, and no rule, move or Factory flow brings a card here. */
  unreached: boolean;
  /** New cards start here: the board's first phase. */
  start: boolean;
}

export interface CanvasModel {
  rows: PhaseRow[];
  /** This board's rules that send its cards to another board. */
  leaving: RuleLine[];
  /** Rules into a phase the board no longer has. */
  stray: RuleLine[];
  /** Other boards' rules that move their cards into a phase this board no longer has. */
  strayIncoming: IntakeRouteInfo[];
  /** Every line of the board's rules, trigger by trigger in the order Factory checks them. */
  lines: RuleLine[];
}

interface ModelInput {
  boardKey: string;
  phases: readonly StoredPhaseInfo[];
  /** Every rule of the project, in order; undefined while they haven't loaded. */
  rules: readonly IntakeRouteInfo[] | undefined;
  /** Phases Factory's own code moves cards into, such as the board's Done on a merge. */
  flow?: BoardFlowParts;
  filed?: ReadonlyMap<string, number>;
  skips?: ReadonlyMap<string, RuleSkips>;
}

export function boardRulesOf(rules: readonly IntakeRouteInfo[], boardKey: string): IntakeRouteInfo[] {
  return rules.filter(rule => rule.target.boardKey === boardKey);
}

export function ruleLabel(rule: IntakeRouteInfo, event: RuleEvent): string {
  return rule.when && rule.when.conditions.length > 0 ? rule.name : everythingOn(event);
}

/** Every line of a board's rules, trigger by trigger in the order Factory checks them, new items' triggers first. */
export function ruleLines(
  boardRules: readonly IntakeRouteInfo[],
  extras: Pick<ModelInput, 'filed' | 'skips'> = {},
): RuleLine[] {
  return LANE_ORDER.flatMap(event => {
    const lane = laneRules(boardRules, event);
    return lane.map((rule, index) => {
      const hider = shadowedBy(lane, event, index);
      return {
        rule,
        event,
        rank: index + 1,
        of: lane.length,
        label: ruleLabel(rule, event),
        filed: isOpenedLane(event) ? extras.filed?.get(rule.id) : undefined,
        hiddenBy: hider === -1 ? undefined : hider + 1,
        skipsOutsiders: skipsOutsidersOn(rule, event),
        movesCardsOnly: movesCardsOnly(rule, event),
        skips: extras.skips?.get(rule.id),
      };
    });
  });
}

export function canvasModel({ boardKey, phases, rules: loaded, flow, filed, skips }: ModelInput): CanvasModel {
  const rules = loaded ?? [];
  const initialPhase = phases[0]?.key ?? '';
  const own = boardRulesOf(rules, boardKey);
  const lines = ruleLines(own, { filed, skips });
  const reaching = boardFlow(rules, { key: boardKey, initialPhase }).into;
  const movedInto = new Set(phases.flatMap(phase => nextPhasesOf(phase, phases).filter(key => key !== phase.key)));
  const byFactory = new Set(Object.values(flow ?? {}));
  const keys = new Set(phases.map(phase => phase.key));
  const destination = (line: RuleLine) => line.rule.target.moveToBoardKey ?? line.rule.target.boardKey;
  const staysHere = lines.filter(line => destination(line) === boardKey);
  const incoming = rules.filter(rule => rule.target.boardKey !== boardKey && rule.target.moveToBoardKey === boardKey);
  const into = (rule: IntakeRouteInfo) => rule.target.phaseKey ?? initialPhase;

  return {
    rows: phases.map((phase, index) => ({
      phase,
      lines: staysHere.filter(line => into(line.rule) === phase.key),
      incoming: incoming.filter(rule => into(rule) === phase.key),
      unreached:
        loaded !== undefined &&
        index > 0 &&
        !reaching.has(phase.key) &&
        !movedInto.has(phase.key) &&
        !byFactory.has(phase.key),
      start: phase.key === initialPhase,
    })),
    leaving: lines.filter(line => destination(line) !== boardKey),
    stray: staysHere.filter(line => !keys.has(into(line.rule))),
    strayIncoming: incoming.filter(rule => !keys.has(into(rule))),
    lines,
  };
}

/** The moves a phase's agent makes on its own: the exit tool's when it's approved on its own, else every outcome's. */
export function movesOnItsOwn(phase: StoredPhaseInfo, phases: readonly StoredPhaseInfo[]): Set<string> {
  if (phase.kind !== 'working') return new Set();
  const outcomes = phase.outcomes ?? defaultOutcomes(phase, phases);
  if (!phase.exitTool) return new Set(outcomes.map(outcome => outcome.to));
  if (!phase.exitTool.autoApprove) return new Set();
  const exit = exitToolOutcome(outcomes, phases);
  return new Set(exit ? [exit.to] : []);
}

export interface SessionSpan {
  label: string;
  /** Index of the first and last phase it covers. */
  from: number;
  to: number;
}

/**
 * Which phases share an agent session: a run of working phases in one context keeps its session, a context seen
 * before picks its session up again, and terminal phases stop them.
 */
export function sessionSpans(phases: readonly StoredPhaseInfo[]): SessionSpan[] {
  const spans: SessionSpan[] = [];
  const seen = new Set<string>();
  let open: (SessionSpan & { context?: string }) | undefined;
  phases.forEach((phase, index) => {
    const context =
      phase.kind === 'working'
        ? (phase.runner?.context ?? DEFAULT_SESSION)
        : phase.kind === 'terminal'
          ? ''
          : undefined;
    if (open && context === open.context && index === open.to + 1) {
      open.to = index;
      return;
    }
    if (open) spans.push({ label: open.label, from: open.from, to: open.to });
    if (context === undefined) {
      open = undefined;
      return;
    }
    const label = context === '' ? 'sessions stop' : `${seen.has(context) ? 'same ' : ''}${context} session`;
    if (context) seen.add(context);
    open = { label, from: index, to: index, context };
  });
  if (open) spans.push({ label: open.label, from: open.from, to: open.to });
  return spans;
}

function ordinal(place: number): string {
  const tens = place % 100;
  if (tens >= 11 && tens <= 13) return `${place}th`;
  return `${place}${{ 1: 'st', 2: 'nd', 3: 'rd' }[place % 10] ?? 'th'}`;
}

function listed(names: readonly string[]): string {
  if (names.length < 2) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
}

/** Where a board stands in the intake order, under a title naming new issues and pull requests. */
export function intakeSentence(order: readonly IntakeOrderBoard[], evaluator: Evaluator, boardKey: string): string {
  if (evaluator === 'route-list') return 'Still filed by the old route list until someone saves an order.';
  const at = order.findIndex(board => board.boardKey === boardKey);
  if (at === -1) return 'Not in the intake order: none reach this board.';
  const before = order.slice(0, at).map(board => board.name);
  const next = order[at + 1]?.name;
  const after = before.length ? `, after ${listed(before)}` : '';
  return `Asked ${ordinal(at + 1)}${after}; the rest ${next ? `go on to ${next}` : 'end Not routed'}.`;
}

interface FallbackContext {
  boardKey: string;
  /** This board's rules, every one: a disabled rule still takes a close from Factory's own mapping. */
  boardRules: readonly IntakeRouteInfo[];
  order?: readonly IntakeOrderBoard[];
  evaluator?: Evaluator;
  phaseName: (key: string | undefined) => string | undefined;
  flow?: BoardFlowParts;
}

/** What happens to an item or card no rule on the trigger takes; undefined when a rule takes everything. */
export function triggerFallback(event: RuleEvent, context: FallbackContext): string | undefined {
  const lane = laneRules(context.boardRules, event);
  if (catchAllIndex(lane, event) !== -1) return undefined;
  if (isOpenedLane(event)) {
    return context.evaluator === 'route-list'
      ? 'Otherwise: the old route list decides'
      : arrivalFallback(context.order, context.boardKey);
  }
  const completed = context.phaseName(context.flow?.completed);
  if (event === 'work_item.closed' && lane.length === 0 && completed) {
    const canceled = context.phaseName(context.flow?.canceled);
    return canceled ? `No rule: ${completed}, or ${canceled} if not planned` : `No rule: ${completed}`;
  }
  if (event === 'pull_request.merged' && completed) return `Otherwise: Factory moves it to ${completed}`;
  if (event.startsWith('pull_request.')) return 'Otherwise: Factory’s own move, else it stays';
  return 'Otherwise, the card stays where it is';
}

const SKIP_REASON = /was skipped: (.+?)\.?$/;

/** "Skipped 3 times in the last 30 days: its target couldn't take the card." */
function skipText(skips: RuleSkips): string {
  const reason = skips.latest.reason?.match(SKIP_REASON)?.[1] ?? 'its target couldn’t take the card';
  const times = skips.count === 1 ? 'once' : `${skips.count} times`;
  return `Skipped ${times} in the last 30 days: ${reason}.`;
}

export interface RuleNote {
  /** Warnings mark the rule's chip; the rest only explain it. */
  tone: 'warning' | 'muted';
  text: string;
  /** A note the rule panel acts on: the latest skipped item, or letting outside authors match. */
  kind?: 'skips' | 'outsiders';
}

/** What is worth knowing about a rule on one trigger, worst first. */
export function ruleNotes(line: RuleLine): RuleNote[] {
  const notes: RuleNote[] = line.rule.problems.map(text => ({ tone: 'warning', text }));
  if (line.hiddenBy !== undefined) {
    notes.push({
      tone: 'warning',
      text: `Never reached: rule ${line.hiddenBy} above matches ${everythingOn(line.event).toLowerCase()}.`,
    });
  }
  if (!line.rule.enabled) notes.push({ tone: 'muted', text: 'Off, skipped' });
  if (line.skips) notes.push({ tone: 'muted', text: skipText(line.skips), kind: 'skips' });
  if (line.skipsOutsiders) {
    notes.push({ tone: 'muted', text: 'Skips outside authors’ pull requests (older rule).', kind: 'outsiders' });
  }
  if (line.movesCardsOnly) notes.push({ tone: 'muted', text: 'Moves cards only: files no new pull requests.' });
  if (isLegacyOpened(line.rule)) {
    notes.push({ tone: 'muted', text: 'Listens on Issue or pull request opened (legacy).' });
  }
  return notes;
}

/**
 * Where a rule stands among the board's rules on its trigger, each named with where it sends what it takes: "Checked
 * 2nd on Issue closed, after “Not planned” → Canceled." Nothing for a rule alone on its trigger.
 */
export function orderNote(
  line: RuleLine,
  lines: readonly RuleLine[],
  into: (line: RuleLine) => string,
): string | undefined {
  if (line.of < 2) return undefined;
  const lane = lines.filter(other => other.event === line.event);
  const steps = (others: readonly RuleLine[]) => listed(others.map(other => `“${other.label}” → ${into(other)}`));
  const checked = `Checked ${ordinal(line.rank)} on ${laneText(line.event).label}`;
  return line.rank === 1
    ? `${checked}, before ${steps(lane.slice(1))}.`
    : `${checked}, after ${steps(lane.slice(0, line.rank - 1))}.`;
}

/**
 * How a chip or phase reads beside the selection: the selected one rings, unrelated ones fade. `elsewhere` is a
 * tested item's rule that matched but lost it to another board.
 */
export type Emphasis = 'selected' | 'dimmed' | 'elsewhere' | undefined;

/**
 * What the canvas has in view: a phase, a rule or a tested item's answer on this board from the side panel, and the
 * trigger of a numbered chip being pointed at.
 */
export interface CanvasSelection {
  phase?: string;
  rule?: string;
  test?: { boardKey: string; result: IntakeTestResponse };
  lane?: RuleEvent;
}

export interface CanvasEmphasis {
  /** A rule chip; `phaseKey` is the row it sits on, absent outside the phase rows. */
  line: (line: RuleLine, phaseKey?: string) => Emphasis;
  node: (phaseKey: string) => Emphasis;
  /** Another board's rule shown here. */
  outside: (ruleId: string) => Emphasis;
}

/** The selected one rings, a lit one shows as it is, and the rest fade. */
function emphasize(selected: boolean, lit: boolean): Emphasis {
  if (selected) return 'selected';
  if (lit) return undefined;
  return 'dimmed';
}

/**
 * A pointed-at trigger lights every rule on it and the phases they file into, keeping what the panel has selected
 * ringed; a selected rule lights the rules on its triggers and the phase it files into; a selected phase lights its
 * own rules, itself and the phases it moves cards to; a tested item lights the rules that matched it and their phases.
 * The rest fades.
 */
export function emphasisOf(
  model: CanvasModel,
  phases: readonly StoredPhaseInfo[],
  selection: CanvasSelection,
): CanvasEmphasis {
  const { rule, test, lane } = selection;
  const phase = selection.phase ? phases.find(candidate => candidate.key === selection.phase) : undefined;
  if (lane) {
    const into = new Set(
      model.rows.filter(row => row.lines.some(line => line.event === lane)).map(row => row.phase.key),
    );
    return {
      line: line => emphasize(line.rule.id === rule, line.event === lane),
      node: key => emphasize(key === phase?.key, into.has(key)),
      outside: id => emphasize(id === rule, false),
    };
  }
  if (rule) {
    const events = new Set(model.lines.filter(line => line.rule.id === rule).map(line => line.event));
    const target = model.rows.find(row => row.lines.some(line => line.rule.id === rule))?.phase.key;
    return {
      line: line => emphasize(line.rule.id === rule, events.has(line.event)),
      node: key => emphasize(false, key === target),
      outside: id => emphasize(id === rule, false),
    };
  }
  if (test) return testEmphasis(test.boardKey, test.result);
  if (phase) {
    const lit = new Set(nextPhasesOf(phase, phases));
    return {
      line: (_line, key) => emphasize(false, key === phase.key),
      node: key => emphasize(key === phase.key, lit.has(key)),
      outside: () => 'dimmed',
    };
  }
  return { line: () => undefined, node: () => undefined, outside: () => undefined };
}

function testEmphasis(boardKey: string, result: IntakeTestResponse): CanvasEmphasis {
  const answers = new Map<string, Emphasis>();
  const lit = new Set<string>();
  const own = result.boards.find(board => board.boardKey === boardKey)?.rules ?? [];
  for (const answer of own) {
    if (answer.outcome === 'took') answers.set(answer.routeId, 'selected');
    else if (answer.outcome === 'lost') {
      answers.set(answer.routeId, answer.to && answer.to.boardKey !== boardKey ? 'elsewhere' : undefined);
    } else continue;
    lit.add(answer.phase);
  }
  for (const move of result.moves) {
    for (const answer of move.rules) if (answer.outcome === 'took') answers.set(answer.routeId, 'selected');
    if (move.to?.boardKey === boardKey) lit.add(move.to.phase);
  }
  if (result.placement?.boardKey === boardKey && result.placement.phase) lit.add(result.placement.phase);
  if (result.current?.boardKey === boardKey && result.current.phase) lit.add(result.current.phase);
  const of = (id: string): Emphasis => (answers.has(id) ? answers.get(id) : 'dimmed');
  return {
    line: line => of(line.rule.id),
    node: key => (lit.has(key) ? undefined : 'dimmed'),
    outside: of,
  };
}
