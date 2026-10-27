import type { RuleGroup } from '../rules/rule-group.js';
import type { FactoryRuleSource, FactoryStageRuleContext } from '../rules/types.js';
import type { StoredPhaseKind, StoredPhaseRunner } from '../storage/domains/boards/validation.js';
import { FACTORY_AGENT_IDS } from './agents.js';
import { runnerForSkill } from './config.js';
import { defineBoard } from './define-board.js';
import type { BoardPhaseDefinition, BoardSourceClosed, BoardToolRule } from './define-board.js';
import type { InstalledBoard } from './registry.js';
import type { BoardRunner, BoardRunnerRegistry } from './runners.js';
import type { BoardTransitionPolicy } from './transition-policy.js';
import { exitToolRule } from './work-tool-rules.js';
import { workTransitionPolicy } from './work-transition-policy.js';

/** The parts of a stored board the runtime needs; both stored rows and the code template fit. */
export interface CompilableBoard {
  readonly key: string;
  readonly name: string;
  readonly phases: readonly {
    readonly key: string;
    readonly name: string;
    readonly kind: StoredPhaseKind;
    readonly runner?: StoredPhaseRunner | null;
    readonly nextPhases?: readonly string[] | null;
    readonly exitTool?: string | { readonly id: string } | null;
    readonly autoStart?: boolean;
    readonly autoStartWhen?: RuleGroup | null;
  }[];
}

/**
 * Board-wide behavior that stays code, keyed by stored board key. A stored
 * `work` board keeps the Work board's transition policy and source-closed
 * moves; any other key gets none, as custom code boards do today.
 */
const BOARD_KINDS: Readonly<
  Record<string, { transitionPolicy?: BoardTransitionPolicy; sourceClosed?: BoardSourceClosed<string> }>
> = {
  work: { transitionPolicy: workTransitionPolicy, sourceClosed: { completed: 'done', canceled: 'canceled' } },
};

const ALL_SOURCES = [
  'issue',
  'pullRequest',
  'gitlabIssue',
  'gitlabPullRequest',
  'linearIssue',
  'jiraIssue',
  'incidentioFollowUp',
  'manual',
] as const satisfies readonly FactoryRuleSource[];

/** The card's main context, where a phase without one runs. */
export const MAIN_CONTEXT = 'work';

type StoredAgentRunner = Extract<StoredPhaseRunner, { type: 'agent' }>;

/**
 * The session context a stored agent phase names: `undefined` when it names none (a code runner then
 * keeps its own), the main context for `null`.
 */
export function phaseContext(runner: StoredAgentRunner): string | undefined {
  if (runner.context === null) return MAIN_CONTEXT;
  return runner.context ?? runner.seat;
}

/**
 * A stored agent runner: entering the phase runs the card's agent in the phase's context,
 * activating the skill (when set) with the instructions as its arguments, or sending the
 * instructions as a plain prompt.
 */
function agentRunner(phaseKey: string, runner: StoredAgentRunner): BoardRunner {
  const instructions = runner.instructions?.trim();
  const role = phaseContext(runner) ?? MAIN_CONTEXT;
  const enter = (context: FactoryStageRuleContext) => {
    const card = context.item.url
      ? `Work item: ${context.item.title} (${context.item.url})`
      : `Work item: ${context.item.title}`;
    const base = {
      type: 'invokeSkill' as const,
      idempotencyKey: `${context.ingress.id}:phase-${phaseKey}`,
      role,
    };
    return runner.skill
      ? { ...base, skillName: runner.skill, arguments: instructions ? `${card}\n\n${instructions}` : card }
      : { ...base, prompt: `${instructions}\n\n${card}` };
  };
  return {
    id: runner.agentId,
    role,
    onEnter: Object.fromEntries(ALL_SOURCES.map(source => [source, enter])),
  };
}

function withInstructions(runner: BoardRunner, instructions: string | undefined): BoardRunner {
  const text = instructions?.trim();
  if (!text || !runner.onEnter) return runner;
  return {
    ...runner,
    onEnter: Object.fromEntries(
      Object.entries(runner.onEnter).map(([source, handler]) => [
        source,
        async (context: FactoryStageRuleContext) => {
          const decision = await handler?.(context);
          if (decision?.type !== 'invokeSkill') return decision;
          if (decision.goal !== undefined) return { ...decision, goal: `${decision.goal}\n\n${text}` };
          if (decision.prompt !== undefined) return { ...decision, prompt: `${decision.prompt}\n\n${text}` };
          return { ...decision, arguments: [decision.arguments, text].filter(Boolean).join('\n\n') };
        },
      ]),
    ),
  };
}

/**
 * A code runner moved to another context: the phase works in it, and runs the code would start in its
 * own context start there instead. Runs the code pins elsewhere keep their context — the independent
 * reviewer stays in `review`, feedback on a change request still reaches its builder.
 */
function inContext(runner: BoardRunner, context: string | undefined): BoardRunner {
  if (context === undefined || !runner.role || context === runner.role) return runner;
  const own = runner.role;
  const onEnter =
    runner.onEnter &&
    Object.fromEntries(
      Object.entries(runner.onEnter).map(([source, handler]) => [
        source,
        async (context_: FactoryStageRuleContext) => {
          const decision = await handler?.(context_);
          return decision && 'role' in decision && decision.role === own ? { ...decision, role: context } : decision;
        },
      ]),
    );
  return { ...runner, role: context, ...(onEnter ? { onEnter } : {}) };
}

/**
 * Turns a stored board into the `BoardDefinition` the runtime runs. A phase
 * without `nextPhases` may move to any phase; one with it may move only there.
 * An agent phase runs on one of Factory's agents; its skill picks the code that
 * decides each run (the built-in Factory skills have some), else the skill or
 * instructions just run. A working phase naming an unknown agent or workflow
 * (or with no context) runs nothing and compiles as resting, so its cards wait
 * for a person.
 */
export function compileStoredBoard(
  board: CompilableBoard,
  runners: BoardRunnerRegistry,
  options: { warn?: (message: string) => void } = {},
): InstalledBoard {
  const allKeys = board.phases.map(phase => phase.key);
  const tools: Record<string, BoardToolRule> = {};
  const phases: Record<string, BoardPhaseDefinition<string>> = {};

  for (const [index, phase] of board.phases.entries()) {
    let runner: BoardRunner | undefined;
    if (phase.runner?.type === 'agent') {
      if (!FACTORY_AGENT_IDS.has(phase.runner.agentId)) {
        options.warn?.(
          `Board '${board.key}' phase '${phase.key}' names unknown agent '${phase.runner.agentId}'; it runs nothing.`,
        );
      } else {
        // A skill with code behind it (the built-in Factory skills, an app's runners) runs that code.
        const code = phase.runner.skill ? runnerForSkill(runners, phase.runner.skill) : undefined;
        runner = code
          ? inContext(withInstructions(code, phase.runner.instructions), phaseContext(phase.runner))
          : agentRunner(phase.key, phase.runner);
      }
    } else if (phase.runner) {
      const id = phase.runner.workflowId;
      runner = runners.get(id);
      if (!runner)
        options.warn?.(`Board '${board.key}' phase '${phase.key}' names unknown runner '${id}'; it runs nothing.`);
    }
    const targets = phase.nextPhases ?? allKeys;
    const base = {
      title: phase.name,
      // A phase grants the Factory tools its runner works with; a context name grants none.
      factoryTools: runner?.factoryTools ?? [],
      ...(phase.autoStart ? { autoStart: true } : {}),
      ...(phase.autoStart && phase.autoStartWhen ? { autoStartWhen: phase.autoStartWhen } : {}),
      outcomes: Object.fromEntries(targets.map(target => [target, target])),
      ...(runner?.onEnter ? { onEnter: runner.onEnter } : {}),
      ...(runner?.onExit ? { onExit: runner.onExit } : {}),
    };
    if (phase.kind === 'working' && runner?.role) {
      phases[phase.key] = { ...base, kind: 'working', role: runner.role };
    } else if (phase.kind === 'working') {
      if (runner) options.warn?.(`Board '${board.key}' phase '${phase.key}' runner '${runner.id}' has no context.`);
      phases[phase.key] = {
        title: phase.name,
        outcomes: base.outcomes,
        factoryTools: [],
        kind: 'resting',
      };
      continue;
    } else {
      phases[phase.key] = { ...base, kind: phase.kind };
    }
    Object.assign(tools, runner?.tools);
    const nextPhase = board.phases[index + 1]?.key;
    const exitTool = typeof phase.exitTool === 'string' ? phase.exitTool : phase.exitTool?.id;
    // The move tool moves the card itself; it needs no rule to pick the next phase.
    if (exitTool && exitTool !== 'factory_transition_work_item' && nextPhase) {
      // Any agent working the card in this phase may finish it; the tool decides, not the session.
      tools[exitTool] = exitToolRule({ tool: exitTool, phase: phase.key, nextPhase });
    }
  }

  const kind = BOARD_KINDS[board.key];
  const sourceClosed =
    kind?.sourceClosed &&
    phases[kind.sourceClosed.completed]?.kind === 'terminal' &&
    phases[kind.sourceClosed.canceled]?.kind === 'terminal'
      ? kind.sourceClosed
      : undefined;

  return defineBoard({
    id: board.key,
    title: board.name,
    initialPhase: board.phases[0]!.key,
    phases,
    tools,
    ...(kind?.transitionPolicy ? { transitionPolicy: kind.transitionPolicy } : {}),
    ...(sourceClosed ? { sourceClosed } : {}),
  });
}
