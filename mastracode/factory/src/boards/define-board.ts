import type { FactoryRuleHandler, FactoryRuleSource, FactoryStageRuleContext } from '../rules/types.js';
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

export type BoardPhaseDefinition<PhaseId extends string> = {
  readonly title: string;
  readonly next?: PhaseId;
  readonly outcomes?: Readonly<Record<string, PhaseId>>;
  readonly onEnter?: ReadonlyBoardPhaseHandlers;
  readonly onExit?: ReadonlyBoardPhaseHandlers;
};

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

export function defineBoard<
  const BoardId extends string,
  const Phases extends Record<string, BoardPhaseDefinition<keyof Phases & string>>,
>(config: BoardConfig<BoardId, Phases>): BoardDefinition<BoardId, keyof Phases & string> {
  if (config.transitionPolicy !== undefined && typeof config.transitionPolicy !== 'function') {
    throw new BoardDefinitionError('Board transitionPolicy must be a function.');
  }
  const phaseIds = new Set(Object.keys(config.phases));
  if (phaseIds.size === 0) throw new BoardDefinitionError('A board must define at least one phase.');
  if (!phaseIds.has(config.initialPhase)) {
    throw new BoardDefinitionError(`Initial phase "${config.initialPhase}" is not defined.`);
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
  ) as Record<keyof Phases & string, readonly BoardTransition<keyof Phases & string>[]>;

  const phases = Object.freeze(
    Object.fromEntries(
      Object.entries(config.phases).map(([phaseId, phase]) => [
        phaseId,
        Object.freeze({
          title: phase.title,
          ...(phase.next !== undefined ? { next: phase.next } : {}),
          ...(phase.outcomes ? { outcomes: Object.freeze({ ...phase.outcomes }) } : {}),
          ...(phase.onEnter ? { onEnter: Object.freeze({ ...phase.onEnter }) } : {}),
          ...(phase.onExit ? { onExit: Object.freeze({ ...phase.onExit }) } : {}),
        }),
      ]),
    ),
  ) as Readonly<Record<keyof Phases & string, BoardPhaseDefinition<keyof Phases & string>>>;
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
  return Object.freeze({
    id: config.id,
    title: config.title,
    initialPhase: config.initialPhase,
    phases,
    transitions: Object.freeze(transitions),
    rules: Object.freeze(rules),
    ...(config.transitionPolicy ? { transitionPolicy: config.transitionPolicy } : {}),
    allowsTransition(from: keyof Phases & string, to: keyof Phases & string) {
      return from === to || transitions[from]?.some(transition => transition.to === to) === true;
    },
  });
}
