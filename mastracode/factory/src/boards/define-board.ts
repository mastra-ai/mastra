import type { FactoryRuleHandler, FactoryRuleSource, FactoryStageRuleContext } from '../rules/types.js';
import { IDENTIFIER_RE, MAX_ROLE_LENGTH } from '../rules/validation.js';
import type { BoardTransitionPolicy } from './transition-policy.js';

type BoardPhaseHandlers = Partial<Record<FactoryRuleSource, FactoryRuleHandler<FactoryStageRuleContext>>>;
type ReadonlyBoardPhaseHandlers = Readonly<BoardPhaseHandlers>;

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
 * - `working`: an agent in `role` carries the card; a person's move in arms autonomy.
 * - `terminal`: the card is finished; sessions stop and held resources are released.
 */
export type BoardPhaseKind = 'resting' | 'working' | 'terminal';

type BoardPhaseBase<PhaseId extends string> = {
  readonly title: string;
  readonly next?: PhaseId;
  readonly outcomes?: Readonly<Record<string, PhaseId>>;
  readonly onEnter?: ReadonlyBoardPhaseHandlers;
  readonly onExit?: ReadonlyBoardPhaseHandlers;
};

export type BoardPhaseDefinition<PhaseId extends string> =
  | (BoardPhaseBase<PhaseId> & { readonly kind: 'resting'; readonly role?: never })
  | (BoardPhaseBase<PhaseId> & { readonly kind: 'working'; readonly role: string })
  | (BoardPhaseBase<PhaseId> & { readonly kind: 'terminal'; readonly role?: never });

export interface BoardTransition<PhaseId extends string> {
  readonly outcome: string | null;
  readonly to: PhaseId;
}

export interface BoardDefinition<BoardId extends string, PhaseId extends string> {
  readonly id: BoardId;
  readonly title: string;
  readonly initialPhase: PhaseId;
  readonly phases: Readonly<Record<PhaseId, BoardPhaseDefinition<PhaseId>>>;
  readonly transitions: Readonly<Record<PhaseId, readonly BoardTransition<PhaseId>[]>>;
  readonly rules: ReadonlyFactoryBoardRules;
  readonly transitionPolicy?: BoardTransitionPolicy;
  allowsTransition(from: PhaseId, to: PhaseId): boolean;
  /** Declared kind of a phase, or undefined when the board has no such phase. */
  phaseKind(phase: string): BoardPhaseKind | undefined;
  isWorking(phase: string): boolean;
  isTerminal(phase: string): boolean;
  /** Role seated in a working phase; undefined for resting/terminal/unknown phases. */
  roleForPhase(phase: string): string | undefined;
  /** First working phase, in declaration order, carried by `role`. */
  phaseForRole(role: string): PhaseId | undefined;
}

type BoardConfig<BoardId extends string, Phases extends Record<string, BoardPhaseDefinition<keyof Phases & string>>> = {
  id: BoardId;
  title: string;
  initialPhase: keyof Phases & string;
  phases: Phases;
  transitionPolicy?: BoardTransitionPolicy;
};

export class BoardDefinitionError extends Error {
  override name = 'BoardDefinitionError';
}

const PHASE_KINDS: ReadonlySet<string> = new Set<BoardPhaseKind>(['resting', 'working', 'terminal']);

function validatePhaseSemantics(phaseId: string, phase: BoardPhaseDefinition<string>): void {
  if (!PHASE_KINDS.has(phase.kind as string)) {
    throw new BoardDefinitionError(`Phase "${phaseId}" must declare kind 'resting', 'working', or 'terminal'.`);
  }
  if (phase.kind === 'working') {
    const role: unknown = phase.role;
    if (typeof role !== 'string' || role.length === 0 || role.length > MAX_ROLE_LENGTH || !IDENTIFIER_RE.test(role)) {
      throw new BoardDefinitionError(`Working phase "${phaseId}" must declare a valid role.`);
    }
  } else if ((phase as { role?: unknown }).role !== undefined) {
    throw new BoardDefinitionError(`Phase "${phaseId}" is ${phase.kind} and cannot declare a role.`);
  }
}

export function defineBoard<
  const BoardId extends string,
  const Phases extends Record<string, BoardPhaseDefinition<keyof Phases & string>>,
>(config: BoardConfig<BoardId, Phases>): BoardDefinition<BoardId, keyof Phases & string> {
  type PhaseId = keyof Phases & string;
  if (config.transitionPolicy !== undefined && typeof config.transitionPolicy !== 'function') {
    throw new BoardDefinitionError('Board transitionPolicy must be a function.');
  }
  const phaseIds = new Set(Object.keys(config.phases));
  if (phaseIds.size === 0) throw new BoardDefinitionError('A board must define at least one phase.');
  if (!phaseIds.has(config.initialPhase)) {
    throw new BoardDefinitionError(`Initial phase "${config.initialPhase}" is not defined.`);
  }
  for (const [phaseId, phase] of Object.entries(config.phases)) validatePhaseSemantics(phaseId, phase);
  if (config.phases[config.initialPhase]!.kind !== 'resting') {
    throw new BoardDefinitionError(`Initial phase "${config.initialPhase}" must be a resting phase.`);
  }

  const transitions = Object.fromEntries(
    Object.entries(config.phases).map(([phaseId, phase]) => {
      if (phase.next !== undefined && phase.outcomes) {
        throw new BoardDefinitionError(`Phase "${phaseId}" cannot define both next and outcomes.`);
      }
      const targets: BoardTransition<string>[] =
        phase.next !== undefined
          ? [Object.freeze({ outcome: null, to: phase.next })]
          : Object.entries(phase.outcomes ?? {}).map(([outcome, to]) => Object.freeze({ outcome, to }));
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
      Object.entries(config.phases).map(([phaseId, phase]) => [
        phaseId,
        Object.freeze({
          title: phase.title,
          kind: phase.kind,
          ...(phase.kind === 'working' ? { role: phase.role } : {}),
          ...(phase.next !== undefined ? { next: phase.next } : {}),
          ...(phase.outcomes ? { outcomes: Object.freeze({ ...phase.outcomes }) } : {}),
          ...(phase.onEnter ? { onEnter: Object.freeze({ ...phase.onEnter }) } : {}),
          ...(phase.onExit ? { onExit: Object.freeze({ ...phase.onExit }) } : {}),
        }),
      ]),
    ),
  ) as Readonly<Record<PhaseId, BoardPhaseDefinition<PhaseId>>>;
  const rules = Object.freeze(
    Object.fromEntries(
      Object.entries(config.phases).flatMap(([phaseId, phase]) => {
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
  for (const [phaseId, phase] of Object.entries(phases) as [PhaseId, BoardPhaseDefinition<PhaseId>][]) {
    kinds.set(phaseId, phase.kind);
    if (phase.kind !== 'working') continue;
    roles.set(phaseId, phase.role);
    if (!phaseByRole.has(phase.role)) phaseByRole.set(phase.role, phaseId);
  }

  return Object.freeze({
    id: config.id,
    title: config.title,
    initialPhase: config.initialPhase,
    phases,
    transitions: Object.freeze(transitions),
    rules: Object.freeze(rules),
    ...(config.transitionPolicy ? { transitionPolicy: config.transitionPolicy } : {}),
    allowsTransition(from: PhaseId, to: PhaseId) {
      return from === to || transitions[from]?.some(transition => transition.to === to) === true;
    },
    phaseKind: (phase: string) => kinds.get(phase),
    isWorking: (phase: string) => kinds.get(phase) === 'working',
    isTerminal: (phase: string) => kinds.get(phase) === 'terminal',
    roleForPhase: (phase: string) => roles.get(phase),
    phaseForRole: (role: string) => phaseByRole.get(role),
  });
}
