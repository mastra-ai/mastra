import { cardRuleGroupSchema, evaluateRuleGroup } from '../rules/rule-group.js';
import type { RuleFacts, RuleGroup } from '../rules/rule-group.js';
import {
  FACTORY_GITHUB_EVENTS,
  FACTORY_RULE_SOURCES,
  FACTORY_GITLAB_EVENTS,
  FACTORY_INCIDENTIO_EVENTS,
  FACTORY_JIRA_EVENTS,
  FACTORY_LINEAR_EVENTS,
} from '../rules/types.js';
import type {
  FactoryGithubEventName,
  FactoryGithubRuleContext,
  FactoryGitLabEventName,
  FactoryGitLabRuleContext,
  FactoryIncidentioEventName,
  FactoryIncidentioRuleContext,
  FactoryJiraEventName,
  FactoryJiraRuleContext,
  FactoryLinearEventName,
  FactoryLinearRuleContext,
  FactoryRuleHandler,
  FactoryRuleSource,
  FactoryStageRuleContext,
  FactoryToolResultRuleContext,
} from '../rules/types.js';
import {
  IDENTIFIER_RE,
  isBoardIdentifier,
  MAX_ROLE_LENGTH,
  MAX_SKILL_NAME_LENGTH,
  MAX_TOOL_NAME_LENGTH,
  SKILL_NAME_RE,
} from '../rules/validation.js';
import { addInstructions, startSkill } from './phase-runner.js';
import type { BoardTransitionPolicy } from './transition-policy.js';

type BoardPhaseHandlers = Partial<Record<FactoryRuleSource, FactoryRuleHandler<FactoryStageRuleContext>>>;
type ReadonlyBoardPhaseHandlers = Readonly<BoardPhaseHandlers>;

/** Runs when an agent seated on this board completes the named tool. */
export type BoardToolResultRuleHandler = FactoryRuleHandler<FactoryToolResultRuleContext>;
export type BoardToolRule = { readonly onResult: BoardToolResultRuleHandler };
export type BoardToolRules = Readonly<Record<string, BoardToolRule>>;

/**
 * A board's handler for one integration event. `null` switches the integration default off
 * for cards on this board only.
 */
type BoardEventHandlerMap<EventName extends string, Context> = Readonly<
  Partial<Record<EventName, FactoryRuleHandler<Context> | null>>
>;

/**
 * How cards on this board react to integration events, keyed by integration then event.
 * Consulted for events bound to a card on this board, after any handler the deployment set
 * explicitly on the integration and before the integration default.
 */
export interface BoardEventRules {
  readonly github?: BoardEventHandlerMap<FactoryGithubEventName, FactoryGithubRuleContext>;
  readonly gitlab?: BoardEventHandlerMap<FactoryGitLabEventName, FactoryGitLabRuleContext>;
  readonly linear?: BoardEventHandlerMap<FactoryLinearEventName, FactoryLinearRuleContext>;
  readonly jira?: BoardEventHandlerMap<FactoryJiraEventName, FactoryJiraRuleContext>;
  readonly incidentio?: BoardEventHandlerMap<FactoryIncidentioEventName, FactoryIncidentioRuleContext>;
}
export type BoardEventIntegration = keyof BoardEventRules;

const BOARD_EVENT_NAMES: Readonly<Record<BoardEventIntegration, readonly string[]>> = {
  github: FACTORY_GITHUB_EVENTS,
  gitlab: FACTORY_GITLAB_EVENTS,
  linear: FACTORY_LINEAR_EVENTS,
  jira: FACTORY_JIRA_EVENTS,
  incidentio: FACTORY_INCIDENTIO_EVENTS,
};

type ReadonlyFactoryBoardRules = Readonly<
  Record<
    string,
    Readonly<
      Partial<
        Record<
          FactoryRuleSource,
          Readonly<{
            onEnter?: FactoryRuleHandler<FactoryStageRuleContext>;
            onExit?: FactoryRuleHandler<FactoryStageRuleContext>;
          }>
        >
      >
    >
  >
>;

/**
 * What a phase means to the runtime.
 * - `resting`: nobody is seated; a card waits for a person or an event.
 * - `working`: an agent in the phase's context carries the card; a person's move in arms autonomy.
 * - `terminal`: the card is finished; sessions stop and held resources are released.
 */
export type BoardPhaseKind = 'resting' | 'working' | 'terminal';

/** The agent Factory runs every phase with. */
export const FACTORY_AGENT_ID = 'code-agent';

/** The session context a working phase runs in when it names none. */
export const DEFAULT_PHASE_CONTEXT = 'work';

/** Who runs a working phase, and with what. */
export interface BoardPhaseRunner {
  /** Must be `code-agent`, the agent Factory runs; omitted means that agent. */
  readonly agentId?: string;
  /** Skill started when a card enters the phase from a source with no `onEnter` handler. */
  readonly skill?: string;
  /**
   * The session the phase runs in. Phases naming the same context share one session per card;
   * a different context gets its own. Defaults to `work`.
   */
  readonly context?: string;
  /** Appended to every run the phase starts. */
  readonly instructions?: string;
}

/**
 * The tool whose successful call ends a working phase. The agent then moves the card itself with
 * `factory_transition_work_item`, to one of the phase's `nextPhases`.
 */
export interface BoardPhaseExitTool {
  readonly id: string;
  /**
   * Answer the approval the tool waits for without a person. Factory sessions run other tools
   * without asking, so today this applies to `submit_plan`. Defaults to false.
   */
  readonly autoApprove?: boolean;
  /** With `autoApprove`, only cards this matches are approved without a person. */
  readonly autoApproveWhen?: RuleGroup;
}

type BoardPhaseBase<PhaseId extends string> = {
  readonly name?: string;
  /** @deprecated Use `name`. */
  readonly title?: string;
  readonly description?: string;
  /** Phases a card may move to from here. */
  readonly nextPhases?: readonly PhaseId[];
  /** @deprecated List the phase in `nextPhases`. */
  readonly next?: PhaseId;
  /** Named moves rules can choose by outcome; each target is also an allowed next phase. */
  readonly outcomes?: Readonly<Record<string, PhaseId>>;
  readonly onEnter?: ReadonlyBoardPhaseHandlers;
  readonly onExit?: ReadonlyBoardPhaseHandlers;
};

type WorkingPhaseFields = {
  readonly runner?: BoardPhaseRunner;
  /** @deprecated Use `runner.context`. */
  readonly role?: string;
  /** Runs start without anyone approving them, even with the project's auto-run off. */
  readonly autoStart?: boolean;
  /** With `autoStart`, only cards this matches start on their own. */
  readonly autoStartWhen?: RuleGroup;
  /** A bare tool name is shorthand for `{ id }`, with nothing approved on a person's behalf. */
  readonly exitTool?: string | BoardPhaseExitTool;
};

type NonWorkingPhaseFields = {
  readonly runner?: never;
  readonly role?: never;
  readonly autoStart?: never;
  readonly autoStartWhen?: never;
  readonly exitTool?: never;
};

/** A phase as a board declares it. */
export type BoardPhaseDefinition<PhaseId extends string> =
  | (BoardPhaseBase<PhaseId> & NonWorkingPhaseFields & { readonly kind: 'resting' })
  | (BoardPhaseBase<PhaseId> & WorkingPhaseFields & { readonly kind: 'working' })
  | (BoardPhaseBase<PhaseId> & NonWorkingPhaseFields & { readonly kind: 'terminal' });

type ResolvedPhaseBase<PhaseId extends string> = {
  readonly name: string;
  readonly description?: string;
  /** Every phase a card may move to from here, including outcome targets. */
  readonly nextPhases: readonly PhaseId[];
  readonly outcomes?: Readonly<Record<string, PhaseId>>;
  readonly onEnter?: ReadonlyBoardPhaseHandlers;
  readonly onExit?: ReadonlyBoardPhaseHandlers;
};

/**
 * A phase as the board resolved it: deprecated fields are replaced by their new names, so
 * only the new structure leaves `defineBoard()`, and a resolved phase can be declared again.
 */
export type BoardPhase<PhaseId extends string> =
  | (ResolvedPhaseBase<PhaseId> & { readonly kind: 'resting' })
  | (ResolvedPhaseBase<PhaseId> & {
      readonly kind: 'working';
      readonly runner: Readonly<BoardPhaseRunner & { agentId: string; context: string }>;
      readonly autoStart?: boolean;
      readonly autoStartWhen?: RuleGroup;
      readonly exitTool?: Readonly<{ id: string; autoApprove: boolean; autoApproveWhen?: RuleGroup }>;
    })
  | (ResolvedPhaseBase<PhaseId> & { readonly kind: 'terminal' });

type ResolvedRunner = Extract<BoardPhase<string>, { kind: 'working' }>['runner'];
type ResolvedExitTool = Extract<BoardPhase<string>, { kind: 'working' }>['exitTool'];

export interface BoardTransition<PhaseId extends string> {
  readonly outcome: string | null;
  readonly to: PhaseId;
}

/**
 * Terminal phases a card moves to when its tracked source (issue or follow-up) closes.
 * `completed` is used when the source was completed, `canceled` when it was canceled or not planned.
 */
export type BoardSourceClosed<PhaseId extends string> = Readonly<{ completed: PhaseId; canceled: PhaseId }>;

export interface BoardDefinition<BoardId extends string, PhaseId extends string> {
  readonly id: BoardId;
  readonly name: string;
  readonly description?: string;
  readonly initialPhase: PhaseId;
  readonly phases: Readonly<Record<PhaseId, BoardPhase<PhaseId>>>;
  readonly transitions: Readonly<Record<PhaseId, readonly BoardTransition<PhaseId>[]>>;
  readonly rules: ReadonlyFactoryBoardRules;
  /** Tool-result rules keyed by tool name; empty when the board declares none. */
  readonly tools: BoardToolRules;
  /** Integration event handlers for cards on this board; empty when the board declares none. */
  readonly events: BoardEventRules;
  readonly transitionPolicy?: BoardTransitionPolicy;
  /** Where source-closed rules move a card; absent when the board opts out of auto-closing. */
  readonly sourceClosed?: BoardSourceClosed<PhaseId>;
  allowsTransition(from: PhaseId, to: PhaseId): boolean;
  /** Declared kind of a phase, or undefined when the board has no such phase. */
  phaseKind(phase: string): BoardPhaseKind | undefined;
  isWorking(phase: string): boolean;
  isTerminal(phase: string): boolean;
  /** Session context of a working phase; undefined for resting/terminal/unknown phases. */
  roleForPhase(phase: string): string | undefined;
  /** First working phase, in declaration order, running in `role`'s context. */
  phaseForRole(role: string): PhaseId | undefined;
  /**
   * Whether the phase's runs start without anyone approving them, for a card with these facts
   * (`cardRuleFacts`). A phase with a start condition never starts on its own without facts.
   */
  startsAutomatically(phase: string, facts?: RuleFacts): boolean;
}

type BoardConfig<BoardId extends string, Phases extends Record<string, BoardPhaseDefinition<keyof Phases & string>>> = {
  id: BoardId;
  name?: string;
  /** @deprecated Use `name`. */
  title?: string;
  description?: string;
  initialPhase: keyof Phases & string;
  phases: Phases;
  tools?: Record<string, BoardToolRule>;
  events?: BoardEventRules;
  transitionPolicy?: BoardTransitionPolicy;
  sourceClosed?: { completed: keyof Phases & string; canceled: keyof Phases & string };
};

export class BoardDefinitionError extends Error {
  override name = 'BoardDefinitionError';
}

const PHASE_KINDS: ReadonlySet<string> = new Set<BoardPhaseKind>(['resting', 'working', 'terminal']);

function validateBoardIdentifier(value: unknown, label: string): void {
  if (!isBoardIdentifier(value)) {
    throw new BoardDefinitionError(`${label} must be a valid board identifier.`);
  }
}

const MAX_NAME_LENGTH = 128;
const MAX_DESCRIPTION_LENGTH = 2_000;
const MAX_INSTRUCTIONS_LENGTH = 1_000;
const RUNNER_KEYS: ReadonlySet<string> = new Set(['agentId', 'skill', 'context', 'instructions']);
const EXIT_TOOL_KEYS: ReadonlySet<string> = new Set(['id', 'autoApprove', 'autoApproveWhen']);
const WORKING_ONLY_FIELDS = ['runner', 'autoStart', 'autoStartWhen', 'exitTool'] as const;
const MOVE_TOOL = 'factory_transition_work_item';

/** `name`, falling back to the deprecated `title`; both may be set only to the same text. */
function resolveName(name: unknown, title: unknown, label: string): string {
  if (name !== undefined && title !== undefined && name !== title) {
    throw new BoardDefinitionError(`${label} sets both name and title; drop the deprecated title.`);
  }
  const value = name ?? title;
  if (typeof value !== 'string' || value.trim().length === 0 || value.length > MAX_NAME_LENGTH) {
    throw new BoardDefinitionError(`${label} must declare a name.`);
  }
  return value;
}

function optionalText(value: unknown, label: string, max: number): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || value.trim().length === 0 || value.length > max) {
    throw new BoardDefinitionError(`${label} must be non-empty text of at most ${max} characters.`);
  }
  return value;
}

function ruleGroup(value: unknown, label: string): RuleGroup | undefined {
  if (value === undefined) return undefined;
  const parsed = cardRuleGroupSchema.safeParse(value);
  if (!parsed.success) {
    throw new BoardDefinitionError(`${label} is not a valid condition: ${parsed.error.issues[0]?.message}`);
  }
  return parsed.data;
}

function isContext(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= MAX_ROLE_LENGTH && IDENTIFIER_RE.test(value);
}

function resolveRunner(phaseId: string, phase: BoardPhaseDefinition<string>): ResolvedRunner {
  const runner: unknown = phase.runner ?? {};
  if (!isPlainObject(runner) || Object.keys(runner).some(key => !RUNNER_KEYS.has(key))) {
    throw new BoardDefinitionError(`Phase "${phaseId}" runner may only set agentId, skill, context and instructions.`);
  }
  const role: unknown = phase.role;
  if (role !== undefined && runner.context !== undefined && role !== runner.context) {
    throw new BoardDefinitionError(`Phase "${phaseId}" sets both role and runner.context; drop the deprecated role.`);
  }
  const context = runner.context ?? role ?? DEFAULT_PHASE_CONTEXT;
  if (!isContext(context)) throw new BoardDefinitionError(`Working phase "${phaseId}" must declare a valid context.`);
  const agentId = runner.agentId ?? FACTORY_AGENT_ID;
  if (agentId !== FACTORY_AGENT_ID) {
    throw new BoardDefinitionError(
      `Phase "${phaseId}" names unknown agent "${String(agentId)}"; Factory runs "${FACTORY_AGENT_ID}".`,
    );
  }
  const skill = runner.skill;
  if (
    skill !== undefined &&
    (typeof skill !== 'string' || skill.length > MAX_SKILL_NAME_LENGTH || !SKILL_NAME_RE.test(skill))
  ) {
    throw new BoardDefinitionError(`Phase "${phaseId}" runner.skill must be a skill name.`);
  }
  const instructions = optionalText(
    runner.instructions,
    `Phase "${phaseId}" runner.instructions`,
    MAX_INSTRUCTIONS_LENGTH,
  );
  return Object.freeze({
    agentId,
    context,
    ...(skill !== undefined ? { skill } : {}),
    ...(instructions !== undefined ? { instructions } : {}),
  });
}

function resolveExitTool(phaseId: string, value: unknown): ResolvedExitTool {
  if (value === undefined) return undefined;
  const declared = typeof value === 'string' ? { id: value } : value;
  if (!isPlainObject(declared) || Object.keys(declared).some(key => !EXIT_TOOL_KEYS.has(key))) {
    throw new BoardDefinitionError(
      `Phase "${phaseId}" exitTool must be a tool name or { id, autoApprove, autoApproveWhen }.`,
    );
  }
  const { id, autoApprove = false } = declared;
  if (typeof id !== 'string' || id.length === 0 || id.length > MAX_TOOL_NAME_LENGTH || !IDENTIFIER_RE.test(id)) {
    throw new BoardDefinitionError(`Phase "${phaseId}" exitTool has an invalid tool name.`);
  }
  if (id === MOVE_TOOL) {
    throw new BoardDefinitionError(
      `Phase "${phaseId}" cannot end with ${MOVE_TOOL}: that tool already moves the card.`,
    );
  }
  if (typeof autoApprove !== 'boolean') {
    throw new BoardDefinitionError(`Phase "${phaseId}" exitTool.autoApprove must be a boolean.`);
  }
  const autoApproveWhen = ruleGroup(declared.autoApproveWhen, `Phase "${phaseId}" exitTool.autoApproveWhen`);
  if (autoApproveWhen && !autoApprove) {
    throw new BoardDefinitionError(`Phase "${phaseId}" exitTool.autoApproveWhen needs autoApprove.`);
  }
  return Object.freeze({ id, autoApprove, ...(autoApproveWhen ? { autoApproveWhen } : {}) });
}

function validatePhaseSemantics(phaseId: string, phase: BoardPhaseDefinition<string>): void {
  if (!PHASE_KINDS.has(phase.kind as string)) {
    throw new BoardDefinitionError(`Phase "${phaseId}" must declare kind 'resting', 'working', or 'terminal'.`);
  }
  if (phase.kind === 'working') return;
  if ((phase as { role?: unknown }).role !== undefined) {
    throw new BoardDefinitionError(`Phase "${phaseId}" is ${phase.kind} and cannot declare a role.`);
  }
  for (const field of WORKING_ONLY_FIELDS) {
    if ((phase as Record<string, unknown>)[field] !== undefined) {
      throw new BoardDefinitionError(`Phase "${phaseId}" is ${phase.kind} and cannot declare ${field}.`);
    }
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function validateToolRules(tools: unknown): BoardToolRules {
  if (tools === undefined) return Object.freeze({});
  if (!isPlainObject(tools)) throw new BoardDefinitionError('Board tools must be a plain object.');
  const frozen: Record<string, BoardToolRule> = {};
  for (const [toolName, leaf] of Object.entries(tools)) {
    if (toolName.length === 0 || toolName.length > MAX_TOOL_NAME_LENGTH || !IDENTIFIER_RE.test(toolName)) {
      throw new BoardDefinitionError(`Tool rule "${toolName}" has an invalid tool name.`);
    }
    if (!isPlainObject(leaf) || Object.keys(leaf).some(key => key !== 'onResult')) {
      throw new BoardDefinitionError(`Tool rule "${toolName}" must be an object with only onResult.`);
    }
    if (typeof leaf.onResult !== 'function') {
      throw new BoardDefinitionError(`Tool rule "${toolName}" must declare an onResult function.`);
    }
    frozen[toolName] = Object.freeze({ onResult: leaf.onResult as BoardToolResultRuleHandler });
  }
  return Object.freeze(frozen);
}

function validateSourceClosed(
  sourceClosed: unknown,
  phases: Readonly<Record<string, BoardPhaseDefinition<string>>>,
): BoardSourceClosed<string> | undefined {
  if (sourceClosed === undefined) return undefined;
  if (!isPlainObject(sourceClosed)) throw new BoardDefinitionError('Board sourceClosed must be a plain object.');
  const keys = Object.keys(sourceClosed);
  if (keys.length !== 2 || !keys.includes('completed') || !keys.includes('canceled')) {
    throw new BoardDefinitionError('Board sourceClosed must declare exactly completed and canceled.');
  }
  for (const key of ['completed', 'canceled'] as const) {
    const phase = sourceClosed[key];
    if (typeof phase !== 'string' || !Object.hasOwn(phases, phase) || phases[phase]!.kind !== 'terminal') {
      throw new BoardDefinitionError(`Board sourceClosed.${key} "${String(phase)}" must name a terminal phase.`);
    }
  }
  return Object.freeze({ completed: sourceClosed.completed as string, canceled: sourceClosed.canceled as string });
}

function validateEventRules(events: unknown): BoardEventRules {
  if (events === undefined) return Object.freeze({});
  if (!isPlainObject(events)) throw new BoardDefinitionError('Board events must be a plain object.');
  const frozen: Record<string, Readonly<Record<string, unknown>>> = {};
  for (const [integration, handlers] of Object.entries(events)) {
    const known = Object.hasOwn(BOARD_EVENT_NAMES, integration)
      ? BOARD_EVENT_NAMES[integration as BoardEventIntegration]
      : undefined;
    if (!known) throw new BoardDefinitionError(`Board events name unknown integration "${integration}".`);
    if (handlers === undefined) continue;
    if (!isPlainObject(handlers)) {
      throw new BoardDefinitionError(`Board events for "${integration}" must be a plain object.`);
    }
    const entries: Record<string, unknown> = {};
    for (const [event, handler] of Object.entries(handlers)) {
      if (!known.includes(event)) {
        throw new BoardDefinitionError(`Board events for "${integration}" name unknown event "${event}".`);
      }
      if (handler === undefined) continue;
      if (handler !== null && typeof handler !== 'function') {
        throw new BoardDefinitionError(`Board event handler "${integration}.${event}" must be a function or null.`);
      }
      entries[event] = handler;
    }
    frozen[integration] = Object.freeze(entries);
  }
  return Object.freeze(frozen) as BoardEventRules;
}

/** The phase's `onEnter` handlers, with its runner's skill for other sources and its instructions on every run. */
function phaseEnterHandlers(
  declared: ReadonlyBoardPhaseHandlers | undefined,
  runner: ResolvedRunner,
): ReadonlyBoardPhaseHandlers | undefined {
  const handlers: BoardPhaseHandlers = { ...declared };
  if (runner.skill) {
    for (const source of FACTORY_RULE_SOURCES) handlers[source] ??= startSkill(runner.skill, runner.context);
  }
  if (runner.instructions) {
    for (const source of Object.keys(handlers) as FactoryRuleSource[]) {
      handlers[source] = addInstructions(handlers[source]!, runner.instructions);
    }
  }
  return Object.keys(handlers).length > 0 ? handlers : undefined;
}

const warnedBoards = new Set<string>();

type DeclaredBoard = {
  readonly id: string;
  readonly name?: string;
  readonly title?: string;
  readonly phases: Readonly<Record<string, BoardPhaseDefinition<string>>>;
};

/** Deprecated fields a board declaration still uses; `defineBoard()` maps each to its replacement. */
function deprecatedFields(config: DeclaredBoard): string[] {
  const found: string[] = [];
  if (config.title !== undefined) found.push('title → name');
  for (const [phaseId, phase] of Object.entries(config.phases)) {
    if (phase.title !== undefined) found.push(`phases.${phaseId}.title → name`);
    if (phase.next !== undefined) found.push(`phases.${phaseId}.next → nextPhases`);
    if (phase.role !== undefined) found.push(`phases.${phaseId}.role → runner.context`);
  }
  return found;
}

function warnDeprecatedFields(config: DeclaredBoard): void {
  if (warnedBoards.has(config.id)) return;
  const found = deprecatedFields(config);
  if (found.length === 0) return;
  warnedBoards.add(config.id);
  console.warn(
    `[Mastra Factory] Board "${config.id}" uses deprecated fields: ${found.join(', ')}. ` +
      'They still work but will be removed in a future release.',
  );
}

export function defineBoard<
  const BoardId extends string,
  const Phases extends Record<string, BoardPhaseDefinition<keyof Phases & string>>,
>(config: BoardConfig<BoardId, Phases>): BoardDefinition<BoardId, keyof Phases & string> {
  type PhaseId = keyof Phases & string;
  validateBoardIdentifier(config.id, 'Board id');
  const boardName = resolveName(config.name, config.title, `Board "${config.id}"`);
  const boardDescription = optionalText(config.description, `Board "${config.id}" description`, MAX_DESCRIPTION_LENGTH);
  if (config.transitionPolicy !== undefined && typeof config.transitionPolicy !== 'function') {
    throw new BoardDefinitionError('Board transitionPolicy must be a function.');
  }
  const tools = validateToolRules(config.tools);
  const events = validateEventRules(config.events);
  const phaseIds = new Set(Object.keys(config.phases));
  if (phaseIds.size === 0) throw new BoardDefinitionError('A board must define at least one phase.');
  if (!phaseIds.has(config.initialPhase)) {
    throw new BoardDefinitionError(`Initial phase "${config.initialPhase}" is not defined.`);
  }
  for (const [phaseId, phase] of Object.entries(config.phases)) {
    validateBoardIdentifier(phaseId, 'Phase id');
    validatePhaseSemantics(phaseId, phase);
  }
  if (config.phases[config.initialPhase]!.kind !== 'resting') {
    throw new BoardDefinitionError(`Initial phase "${config.initialPhase}" must be a resting phase.`);
  }
  warnDeprecatedFields(config);
  const sourceClosed = validateSourceClosed(config.sourceClosed, config.phases) as
    | BoardSourceClosed<PhaseId>
    | undefined;

  const transitions = Object.fromEntries(
    Object.entries(config.phases).map(([phaseId, phase]) => {
      if (phase.next !== undefined && phase.outcomes) {
        throw new BoardDefinitionError(`Phase "${phaseId}" cannot define both next and outcomes.`);
      }
      if (phase.nextPhases !== undefined && !Array.isArray(phase.nextPhases)) {
        throw new BoardDefinitionError(`Phase "${phaseId}" nextPhases must be a list of phases.`);
      }
      const targets: BoardTransition<string>[] =
        phase.next !== undefined
          ? [Object.freeze({ outcome: null, to: phase.next })]
          : Object.entries(phase.outcomes ?? {}).map(([outcome, to]) => Object.freeze({ outcome, to }));
      for (const to of phase.nextPhases ?? []) {
        if (!targets.some(target => target.to === to)) targets.push(Object.freeze({ outcome: null, to }));
      }
      for (const { to } of targets) {
        if (!phaseIds.has(to)) {
          throw new BoardDefinitionError(`Phase "${phaseId}" targets undefined phase "${to}".`);
        }
      }
      return [phaseId, Object.freeze(targets)];
    }),
  ) as Record<PhaseId, readonly BoardTransition<PhaseId>[]>;

  const phases = Object.freeze(
    Object.fromEntries(
      Object.entries(config.phases).map(([phaseId, phase]) => {
        const label = `Phase "${phaseId}"`;
        const nextPhases = Object.freeze([
          ...(phase.nextPhases ?? []).filter((to, index, all) => all.indexOf(to) === index),
          ...transitions[phaseId as PhaseId]!.map(({ to }) => to).filter(to => !phase.nextPhases?.includes(to)),
        ]);
        const runner = phase.kind === 'working' ? resolveRunner(phaseId, phase) : undefined;
        const working = phase.kind === 'working' ? phase : undefined;
        if (working?.autoStart !== undefined && typeof working.autoStart !== 'boolean') {
          throw new BoardDefinitionError(`${label} autoStart must be a boolean.`);
        }
        const autoStartWhen = ruleGroup(working?.autoStartWhen, `${label} autoStartWhen`);
        if (autoStartWhen && working?.autoStart !== true) {
          throw new BoardDefinitionError(`${label} autoStartWhen needs autoStart.`);
        }
        const exitTool = resolveExitTool(phaseId, working?.exitTool);
        if (exitTool && nextPhases.length === 0) {
          throw new BoardDefinitionError(`${label} exit tool needs a next phase to move the card to.`);
        }
        const onEnter = runner ? phaseEnterHandlers(phase.onEnter, runner) : phase.onEnter;
        const name = resolveName(phase.name, phase.title, label);
        const description = optionalText(phase.description, `${label} description`, MAX_DESCRIPTION_LENGTH);
        return [
          phaseId,
          Object.freeze({
            name,
            ...(description !== undefined ? { description } : {}),
            kind: phase.kind,
            nextPhases,
            ...(phase.outcomes ? { outcomes: Object.freeze({ ...phase.outcomes }) } : {}),
            ...(runner ? { runner } : {}),
            ...(working?.autoStart ? { autoStart: true } : {}),
            ...(autoStartWhen ? { autoStartWhen } : {}),
            ...(exitTool ? { exitTool } : {}),
            ...(onEnter ? { onEnter: Object.freeze({ ...onEnter }) } : {}),
            ...(phase.onExit ? { onExit: Object.freeze({ ...phase.onExit }) } : {}),
          }),
        ];
      }),
    ),
  ) as Readonly<Record<PhaseId, BoardPhase<PhaseId>>>;
  const rules = Object.freeze(
    Object.fromEntries(
      (Object.entries(phases) as [PhaseId, BoardPhase<PhaseId>][]).flatMap(([phaseId, phase]) => {
        const sources = new Set([...Object.keys(phase.onEnter ?? {}), ...Object.keys(phase.onExit ?? {})]);
        if (sources.size === 0) return [];
        return [
          [
            phaseId,
            Object.freeze(
              Object.fromEntries(
                [...sources].map(source => [
                  source,
                  Object.freeze({
                    ...(phase.onEnter?.[source as FactoryRuleSource]
                      ? { onEnter: phase.onEnter[source as FactoryRuleSource] }
                      : {}),
                    ...(phase.onExit?.[source as FactoryRuleSource]
                      ? { onExit: phase.onExit[source as FactoryRuleSource] }
                      : {}),
                  }),
                ]),
              ),
            ),
          ],
        ];
      }),
    ),
  ) as ReadonlyFactoryBoardRules;

  const kinds = new Map<string, BoardPhaseKind>();
  const roles = new Map<string, string>();
  const phaseByRole = new Map<string, PhaseId>();
  for (const [phaseId, phase] of Object.entries(phases) as [PhaseId, BoardPhase<PhaseId>][]) {
    kinds.set(phaseId, phase.kind);
    if (phase.kind !== 'working') continue;
    roles.set(phaseId, phase.runner.context);
    if (!phaseByRole.has(phase.runner.context)) phaseByRole.set(phase.runner.context, phaseId);
  }

  return Object.freeze({
    id: config.id,
    name: boardName,
    ...(boardDescription !== undefined ? { description: boardDescription } : {}),
    initialPhase: config.initialPhase,
    phases,
    transitions: Object.freeze(transitions),
    rules: Object.freeze(rules),
    tools,
    events,
    ...(config.transitionPolicy ? { transitionPolicy: config.transitionPolicy } : {}),
    ...(sourceClosed ? { sourceClosed } : {}),
    allowsTransition(from: PhaseId, to: PhaseId) {
      return from === to || transitions[from]?.some(transition => transition.to === to) === true;
    },
    phaseKind: (phase: string) => kinds.get(phase),
    isWorking: (phase: string) => kinds.get(phase) === 'working',
    isTerminal: (phase: string) => kinds.get(phase) === 'terminal',
    roleForPhase: (phase: string) => roles.get(phase),
    phaseForRole: (role: string) => phaseByRole.get(role),
    startsAutomatically: (phase: string, facts?: RuleFacts) => {
      const definition = phases[phase as PhaseId] as BoardPhase<PhaseId> | undefined;
      if (definition?.kind !== 'working' || definition.autoStart !== true) return false;
      if (!definition.autoStartWhen) return true;
      return facts !== undefined && evaluateRuleGroup(definition.autoStartWhen, facts);
    },
  });
}
