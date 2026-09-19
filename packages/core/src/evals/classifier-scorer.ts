import type { SharedV4ProviderMetadata, SharedV4ProviderOptions, SharedV4Warning } from '@ai-sdk/provider-v7';
import type { z } from 'zod/v4';

import type {
  ChoiceQuestion,
  Classifier,
  ClassifierAnswer,
  ClassifierQuestions,
  ClassifierResult,
  ClassifierState,
  ClassifierUsage,
} from '../classifier';
import type { Mastra } from '../mastra';
import {
  createScorer,
  type MastraScorer,
  type ScorerConfig,
  type ScorerTypeShortcuts,
  type StepContext,
} from './base';

type ConfiguredClassifier = Classifier<ClassifierQuestions>;
type QuestionsOf<TClassifier extends ConfiguredClassifier> =
  TClassifier extends Classifier<infer TQuestions extends ClassifierQuestions> ? TQuestions : never;
type QuestionKey<TQuestions extends ClassifierQuestions> = Extract<keyof TQuestions, string>;
type ChoiceKeys<TQuestion> = TQuestion extends ChoiceQuestion<infer TCriteria>
  ? Extract<keyof TCriteria, string>
  : never;

type ClassifierScoreOptions<TQuestion> = TQuestion extends ChoiceQuestion
  ? { scores: Record<ChoiceKeys<TQuestion>, number> }
  : { scores?: never };

export type ClassifierScorerEvidence<
  TQuestions extends ClassifierQuestions,
  TQuestion extends QuestionKey<TQuestions>,
> = {
  question: TQuestion;
  answer: ClassifierAnswer<TQuestions[TQuestion]>;
  usage: ClassifierUsage;
  warnings: SharedV4Warning[];
  rounding?: ClassifierResult<TQuestions>['rounding'];
  providerMetadata?: SharedV4ProviderMetadata;
  response: {
    id?: string;
    timestamp: Date;
    modelId: string;
  };
};

export type ClassifierScorerStateSelector<TInput, TRunOutput> = (
  context: StepContext<Record<string, never>, TInput, TRunOutput>,
) => ClassifierState | Promise<ClassifierState>;

type ClassifierScorerBaseOptions<
  TClassifier extends ConfiguredClassifier,
  TQuestion extends QuestionKey<QuestionsOf<TClassifier>>,
  TID extends string,
  TInput,
  TRunOutput,
> = Omit<ScorerConfig<TID, TInput, TRunOutput>, 'description' | 'judge'> & {
  description?: string;
  classifier: TClassifier | string;
  question: TQuestion;
  state?: ClassifierScorerStateSelector<TInput, TRunOutput>;
  maxRetries?: number;
  providerOptions?: SharedV4ProviderOptions;
} & ClassifierScoreOptions<QuestionsOf<TClassifier>[TQuestion]>;

type ClassifierScorerResult<
  TClassifier extends ConfiguredClassifier,
  TQuestion extends QuestionKey<QuestionsOf<TClassifier>>,
  TID extends string,
  TInput,
  TRunOutput,
> = MastraScorer<
  TID,
  TInput,
  TRunOutput,
  {
    analyzeStepResult: ClassifierScorerEvidence<QuestionsOf<TClassifier>, TQuestion>;
    generateScoreStepResult: number;
    generateReasonStepResult: string;
  }
>;

function assertConfiguredClassifier(classifier: Classifier<ClassifierQuestions>, scorerId: string): void {
  if (!classifier.questions) {
    throw new TypeError(
      `Classifier '${classifier.id}' used by scorer '${scorerId}' must be constructed with configured questions.`,
    );
  }
}

function validateQuestionAndScores(
  classifier: Classifier<ClassifierQuestions>,
  scorerId: string,
  questionKey: string,
  scores: Record<string, number> | undefined,
): void {
  assertConfiguredClassifier(classifier, scorerId);
  const question = classifier.questions[questionKey];
  if (!question) {
    throw new TypeError(
      `Question '${questionKey}' is not configured on classifier '${classifier.id}' for scorer '${scorerId}'.`,
    );
  }

  if (question.type !== 'choice') {
    if (scores !== undefined) {
      throw new TypeError(
        `Scorer '${scorerId}' cannot provide scores for ${question.type} question '${questionKey}'.`,
      );
    }
    return;
  }

  if (!scores || typeof scores !== 'object') {
    throw new TypeError(
      `Scorer '${scorerId}' must provide an exhaustive numeric scores mapping for choice question '${questionKey}'.`,
    );
  }

  const choices = Object.keys(question.criteria);
  const scoreKeys = Object.keys(scores);
  const missing = choices.filter(choice => !(choice in scores));
  const extra = scoreKeys.filter(choice => !(choice in question.criteria));
  const nonNumeric = choices.filter(choice => typeof scores[choice] !== 'number' || !Number.isFinite(scores[choice]));
  if (missing.length || extra.length || nonNumeric.length) {
    throw new TypeError(
      `Invalid scores mapping for choice question '${questionKey}' on scorer '${scorerId}'.` +
        (missing.length ? ` Missing: ${missing.join(', ')}.` : '') +
        (extra.length ? ` Unknown: ${extra.join(', ')}.` : '') +
        (nonNumeric.length ? ` Non-numeric: ${nonNumeric.join(', ')}.` : ''),
    );
  }
}

export function projectClassifierScore(answer: ClassifierAnswer<any>, scores?: Record<string, number>): number {
  if (answer.type === 'choice') {
    const score = scores?.[answer.choice];
    if (typeof score !== 'number') {
      throw new TypeError(`No numeric score is configured for classifier choice '${answer.choice}'.`);
    }
    return score;
  }
  if (answer.type === 'score') {
    return answer.score;
  }
  return answer.probability;
}

function classifierReason(question: string, answer: ClassifierAnswer<any>, score: number): string {
  if (answer.type === 'choice') {
    return `Classifier question '${question}' selected '${answer.choice}' (score: ${score}).`;
  }
  if (answer.type === 'score') {
    return `Classifier question '${question}' returned score ${answer.score}.`;
  }
  return `Classifier question '${question}' returned P(true)=${answer.probability}.`;
}

export function createClassifierScorer<TClassifier extends ConfiguredClassifier>(
  options: {
    [TQuestion in QuestionKey<QuestionsOf<TClassifier>>]: ClassifierScorerBaseOptions<
      TClassifier,
      TQuestion,
      string,
      any,
      any
    > & { classifier: string };
  }[QuestionKey<QuestionsOf<TClassifier>>],
): ClassifierScorerResult<
  TClassifier,
  QuestionKey<QuestionsOf<TClassifier>>,
  string,
  any,
  any
>;

export function createClassifierScorer<
  TClassifier extends ConfiguredClassifier,
  TQuestion extends QuestionKey<QuestionsOf<TClassifier>>,
  TID extends string,
  TType extends keyof ScorerTypeShortcuts,
>(
  options: ClassifierScorerBaseOptions<
    TClassifier,
    TQuestion,
    TID,
    ScorerTypeShortcuts[TType]['input'],
    ScorerTypeShortcuts[TType]['output']
  > & { type: TType },
): ClassifierScorerResult<
  TClassifier,
  TQuestion,
  TID,
  ScorerTypeShortcuts[TType]['input'],
  ScorerTypeShortcuts[TType]['output']
>;

export function createClassifierScorer<
  TClassifier extends ConfiguredClassifier,
  TQuestion extends QuestionKey<QuestionsOf<TClassifier>>,
  TID extends string,
  TInputSchema extends z.ZodTypeAny,
  TOutputSchema extends z.ZodTypeAny,
>(
  options: ClassifierScorerBaseOptions<
    TClassifier,
    TQuestion,
    TID,
    z.infer<TInputSchema>,
    z.infer<TOutputSchema>
  > & { type: { input: TInputSchema; output: TOutputSchema } },
): ClassifierScorerResult<TClassifier, TQuestion, TID, z.infer<TInputSchema>, z.infer<TOutputSchema>>;

export function createClassifierScorer<
  TClassifier extends ConfiguredClassifier,
  TQuestion extends QuestionKey<QuestionsOf<TClassifier>>,
  TInput = any,
  TRunOutput = any,
  TID extends string = string,
>(
  options: ClassifierScorerBaseOptions<TClassifier, TQuestion, TID, TInput, TRunOutput>,
): ClassifierScorerResult<TClassifier, TQuestion, TID, TInput, TRunOutput>;

export function createClassifierScorer(options: any): MastraScorer<any, any, any, any> {
  let mastra: Mastra | undefined;
  const inlineClassifier = typeof options.classifier === 'string' ? undefined : options.classifier;
  if (inlineClassifier) {
    validateQuestionAndScores(inlineClassifier, options.id, options.question, options.scores);
  }

  const scorer = createScorer({
    id: options.id,
    name: options.name,
    description: options.description ?? `Scores question '${options.question}' with a configured classifier`,
    type: options.type,
    prepareRun: options.prepareRun,
  })
    .analyze(async context => {
      const classifier: Classifier<ClassifierQuestions> =
        inlineClassifier ?? resolveRegisteredClassifier(mastra, options.classifier, options.id);
      validateQuestionAndScores(classifier, options.id, options.question, options.scores);

      const state = options.state ? await options.state(context) : context.run.output;
      const result = await classifier.evaluate({
        state,
        abortSignal: context.abortSignal,
        maxRetries: options.maxRetries,
        providerOptions: options.providerOptions,
      });
      const answer = result.answers[options.question];
      if (!answer) {
        throw new TypeError(
          `Classifier '${classifier.id}' did not return question '${options.question}' for scorer '${options.id}'.`,
        );
      }

      return {
        question: options.question,
        answer,
        usage: result.usage,
        warnings: result.warnings,
        rounding: result.rounding,
        providerMetadata: result.providerMetadata,
        response: {
          id: result.response.id,
          timestamp: result.response.timestamp,
          modelId: result.response.modelId,
        },
      };
    })
    .generateScore(({ results }) =>
      projectClassifierScore(results.analyzeStepResult.answer, options.scores),
    )
    .generateReason(({ results, score }) =>
      classifierReason(options.question, results.analyzeStepResult.answer, score),
    );

  scorer.__onRegisterMastra(registeredMastra => {
    mastra = registeredMastra;
  });
  return scorer;
}

function resolveRegisteredClassifier(mastra: Mastra | undefined, classifierId: string, scorerId: string) {
  if (!mastra) {
    throw new Error(
      `Classifier '${classifierId}' for scorer '${scorerId}' cannot be resolved because the scorer is not registered with Mastra. Register both with new Mastra({ classifiers: { ... }, scorers: { ... } }) or pass the classifier instance directly.`,
    );
  }

  try {
    return mastra.getClassifierById(classifierId) as Classifier<ClassifierQuestions>;
  } catch {
    throw new Error(
      `Classifier '${classifierId}' not found for scorer '${scorerId}'. Register it with Mastra classifiers or pass the classifier instance directly.`,
    );
  }
}

export type { ChoiceKeys };
