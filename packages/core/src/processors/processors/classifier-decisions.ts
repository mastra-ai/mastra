import type { ClassifierAnswers, ClassifierQuestions } from '../../classifier';
import type { ClassifierDecide, ClassifierDecision } from './classifier';

type OptionKeys<QUESTION> = QUESTION extends { type: 'choice'; criteria: infer CRITERIA }
  ? Extract<keyof CRITERIA, string>
  : never;

type CommonDecisionOptions = {
  /** Exact abort message used when the decision is `block`. Never includes model output. */
  reason: string;
  /** Consequence when the condition matches. Default: 'block'. */
  action?: 'block' | 'filter';
};

export type BlockIfOptions<QUESTION> = CommonDecisionOptions &
  (QUESTION extends { type: 'boolean' }
    ? /** Trigger when `P(true)` is at least this value. */ { probability: number }
    : QUESTION extends { type: 'choice' }
      ? /** Trigger when the selected option is one of these. */ { oneOf: readonly OptionKeys<QUESTION>[] }
      : QUESTION extends { type: 'score' }
        ? /** Trigger when the score is below `scoreBelow` or above `scoreAbove`. */ {
            scoreBelow?: number;
            scoreAbove?: number;
          }
        : never);

export type BlockUnlessOptions<QUESTION> = CommonDecisionOptions &
  (QUESTION extends { type: 'boolean' }
    ? /** Trigger unless `P(true)` is at least this value. */ { probability: number }
    : QUESTION extends { type: 'choice' }
      ? /** Trigger unless the selected option is one of these. */ { oneOf: readonly OptionKeys<QUESTION>[] }
      : QUESTION extends { type: 'score' }
        ? /** Trigger unless the score is within `[scoreAtLeast, scoreAtMost]`. */ {
            scoreAtLeast?: number;
            scoreAtMost?: number;
          }
        : never);

function triggered(options: CommonDecisionOptions): ClassifierDecision {
  return options.action === 'filter' ? { action: 'filter' } : { action: 'block', reason: options.reason };
}

function matches(answer: ClassifierAnswers<ClassifierQuestions>[string], options: Record<string, unknown>): boolean {
  switch (answer.type) {
    case 'boolean':
      return answer.probability >= (options.probability as number);
    case 'choice':
      return (options.oneOf as readonly string[]).includes(answer.choice);
    case 'score': {
      const below = options.scoreBelow as number | undefined;
      const above = options.scoreAbove as number | undefined;
      return (below !== undefined && answer.score < below) || (above !== undefined && answer.score > above);
    }
  }
}

function satisfies(answer: ClassifierAnswers<ClassifierQuestions>[string], options: Record<string, unknown>): boolean {
  switch (answer.type) {
    case 'boolean':
      return answer.probability >= (options.probability as number);
    case 'choice':
      return (options.oneOf as readonly string[]).includes(answer.choice);
    case 'score': {
      const atLeast = options.scoreAtLeast as number | undefined;
      const atMost = options.scoreAtMost as number | undefined;
      return (atLeast === undefined || answer.score >= atLeast) && (atMost === undefined || answer.score <= atMost);
    }
  }
}

/**
 * Built-in `decide` policies for `ClassifierProcessor`. Each helper returns a typed
 * `ClassifierDecide` function; question keys and choice options are narrowed from the question map.
 */
export const decisions = {
  /**
   * Block (or filter) when the answer to `question` matches the condition.
   * - boolean: `probability` — `P(true) >= probability`
   * - choice: `oneOf` — selected option is in the list
   * - score: `scoreBelow` / `scoreAbove` — score outside the allowed range
   */
  blockIf<Q extends ClassifierQuestions, K extends Extract<keyof Q, string>>(
    question: K,
    options: BlockIfOptions<Q[K]>,
  ): ClassifierDecide<Q> {
    return answers => (matches(answers[question], options) ? triggered(options) : { action: 'pass' });
  },

  /**
   * Block (or filter) unless the answer to `question` satisfies the condition.
   * - boolean: `probability` — `P(true) >= probability`
   * - choice: `oneOf` — selected option is in the list
   * - score: `scoreAtLeast` / `scoreAtMost` — score within the allowed range
   */
  blockUnless<Q extends ClassifierQuestions, K extends Extract<keyof Q, string>>(
    question: K,
    options: BlockUnlessOptions<Q[K]>,
  ): ClassifierDecide<Q> {
    return answers => (satisfies(answers[question], options) ? { action: 'pass' } : triggered(options));
  },

  /**
   * Run `decide` functions in order; the first non-`pass` decision wins.
   */
  all<Q extends ClassifierQuestions>(...decides: ClassifierDecide<Q>[]): ClassifierDecide<Q> {
    return async (answers, ctx) => {
      for (const decide of decides) {
        const decision = await decide(answers, ctx);
        if (decision.action !== 'pass') {
          return decision;
        }
      }
      return { action: 'pass' };
    };
  },
};
