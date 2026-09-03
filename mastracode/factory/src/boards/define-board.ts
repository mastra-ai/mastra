import type {
  FactoryBoardRules,
  FactoryRuleHandler,
  FactoryRuleSource,
  FactoryStageRuleContext,
} from '../rules/types.js';

type BoardPhaseHandlers = Partial<Record<FactoryRuleSource, FactoryRuleHandler<FactoryStageRuleContext>>>;

export type BoardPhaseDefinition<PhaseId extends string> = {
  title: string;
  next?: PhaseId;
  outcomes?: Readonly<Record<string, PhaseId>>;
  onEnter?: BoardPhaseHandlers;
  onExit?: BoardPhaseHandlers;
};

export interface BoardTransition<PhaseId extends string> {
  outcome: string | null;
  to: PhaseId;
}

export interface BoardDefinition<BoardId extends string, PhaseId extends string> {
  id: BoardId;
  title: string;
  initialPhase: PhaseId;
  phases: Readonly<Record<PhaseId, BoardPhaseDefinition<PhaseId>>>;
  transitions: Readonly<Record<PhaseId, readonly BoardTransition<PhaseId>[]>>;
  rules: FactoryBoardRules;
  allowsTransition(from: PhaseId, to: PhaseId): boolean;
}

type BoardConfig<BoardId extends string, Phases extends Record<string, BoardPhaseDefinition<keyof Phases & string>>> = {
  id: BoardId;
  title: string;
  initialPhase: keyof Phases & string;
  phases: Phases;
};

export class BoardDefinitionError extends Error {
  override name = 'BoardDefinitionError';
}

export function defineBoard<
  const BoardId extends string,
  const Phases extends Record<string, BoardPhaseDefinition<keyof Phases & string>>,
>(config: BoardConfig<BoardId, Phases>): BoardDefinition<BoardId, keyof Phases & string> {
  const phaseIds = new Set(Object.keys(config.phases));
  if (phaseIds.size === 0) throw new BoardDefinitionError('A board must define at least one phase.');
  if (!phaseIds.has(config.initialPhase)) {
    throw new BoardDefinitionError(`Initial phase "${config.initialPhase}" is not defined.`);
  }

  const transitions = Object.fromEntries(
    Object.entries(config.phases).map(([phaseId, phase]) => {
      if (phase.next && phase.outcomes) {
        throw new BoardDefinitionError(`Phase "${phaseId}" cannot define both next and outcomes.`);
      }
      const targets: BoardTransition<string>[] = phase.next
        ? [{ outcome: null, to: phase.next }]
        : Object.entries(phase.outcomes ?? {}).map(([outcome, to]) => ({ outcome, to }));
      for (const { to } of targets) {
        if (!phaseIds.has(to)) {
          throw new BoardDefinitionError(`Phase "${phaseId}" targets undefined phase "${to}".`);
        }
      }
      return [phaseId, Object.freeze(targets)];
    }),
  ) as Record<keyof Phases & string, readonly BoardTransition<keyof Phases & string>[]>;

  const phases = Object.freeze({ ...config.phases });
  const rules = Object.fromEntries(
    Object.entries(config.phases).flatMap(([phaseId, phase]) => {
      const sources = new Set([...Object.keys(phase.onEnter ?? {}), ...Object.keys(phase.onExit ?? {})]);
      if (sources.size === 0) return [];
      return [
        [
          phaseId,
          Object.fromEntries(
            [...sources].map(source => [
              source,
              {
                ...(phase.onEnter?.[source as FactoryRuleSource]
                  ? { onEnter: phase.onEnter[source as FactoryRuleSource] }
                  : {}),
                ...(phase.onExit?.[source as FactoryRuleSource]
                  ? { onExit: phase.onExit[source as FactoryRuleSource] }
                  : {}),
              },
            ]),
          ),
        ],
      ];
    }),
  ) as FactoryBoardRules;
  return Object.freeze({
    id: config.id,
    title: config.title,
    initialPhase: config.initialPhase,
    phases,
    transitions: Object.freeze(transitions),
    rules: Object.freeze(rules),
    allowsTransition(from: keyof Phases & string, to: keyof Phases & string) {
      return from === to || transitions[from]?.some(transition => transition.to === to) === true;
    },
  });
}
