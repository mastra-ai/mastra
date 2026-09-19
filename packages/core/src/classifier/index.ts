import {
  APICallError,
  Experimental_EvaluationUnsupportedQuestionTypeError as EvaluationUnsupportedQuestionTypeError,
  type Experimental_EvaluationModelV4 as EvaluationModelV4,
  type Experimental_EvaluationModelV4Answer as EvaluationModelV4Answer,
  type Experimental_EvaluationModelV4Input as EvaluationModelV4Input,
  type Experimental_EvaluationModelV4Question as EvaluationModelV4Question,
  type SharedV4ProviderMetadata,
  type SharedV4ProviderOptions,
  type SharedV4Warning,
} from '@ai-sdk/provider-v7';
import { retryWithExponentialBackoff } from '@ai-sdk/provider-utils-v7';

import { SpanType } from '../observability/types';
import { resolveCurrentSpan } from '../observability/utils';

export type ClassifierState = EvaluationModelV4Input;

export type ChoiceQuestion<CRITERIA extends Readonly<Record<string, EvaluationModelV4Input | null>> = Readonly<Record<string, EvaluationModelV4Input | null>>> = {
  readonly type: 'choice';
  readonly instructions?: EvaluationModelV4Input;
  readonly criteria: CRITERIA;
};

export type ScoreQuestion<CRITERIA extends readonly (EvaluationModelV4Input | null)[] = readonly (EvaluationModelV4Input | null)[]> = {
  readonly type: 'score';
  readonly instructions?: EvaluationModelV4Input;
  readonly criteria: CRITERIA;
};

export type BooleanQuestion = {
  readonly type: 'boolean';
  readonly instructions?: EvaluationModelV4Input;
  readonly criteria?: {
    readonly true?: EvaluationModelV4Input | null;
    readonly false?: EvaluationModelV4Input | null;
  };
};

export type ClassifierQuestion = ChoiceQuestion | ScoreQuestion | BooleanQuestion;
export type ClassifierQuestions = Readonly<Record<string, ClassifierQuestion>>;

export type ChoiceAnswer<OPTION extends string = string> = {
  type: 'choice';
  choice: OPTION;
  probabilities?: Record<OPTION, number>;
};

export type ScoreAnswer = {
  type: 'score';
  score: number;
  probabilities?: Record<string, number>;
};

export type BooleanAnswer = {
  type: 'boolean';
  probability: number;
};

export type ClassifierAnswer<QUESTION extends ClassifierQuestion> = QUESTION extends {
  type: 'choice';
  criteria: infer CRITERIA extends Readonly<Record<string, EvaluationModelV4Input | null>>;
}
  ? ChoiceAnswer<Extract<keyof CRITERIA, string>>
  : QUESTION extends { type: 'score' }
    ? ScoreAnswer
    : QUESTION extends { type: 'boolean' }
      ? BooleanAnswer
      : never;

export type ClassifierAnswers<QUESTIONS extends ClassifierQuestions> = {
  -readonly [KEY in keyof QUESTIONS]: ClassifierAnswer<QUESTIONS[KEY]>;
};

export type ClassifierUsage = {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens: number;
};

export type ClassifierResult<QUESTIONS extends ClassifierQuestions> = {
  answers: ClassifierAnswers<QUESTIONS>;
  usage: ClassifierUsage;
  warnings: SharedV4Warning[];
  rounding?: {
    probabilityDecimals?: number;
    scoreDecimals?: number;
  };
  providerMetadata?: SharedV4ProviderMetadata;
  response: {
    id?: string;
    timestamp: Date;
    modelId: string;
    headers?: Record<string, string | undefined>;
    body?: unknown;
  };
};

type CommonEvaluateOptions = {
  state: ClassifierState;
  abortSignal?: AbortSignal;
  providerOptions?: SharedV4ProviderOptions;
  maxRetries?: number;
};

export type ConfiguredClassifierEvaluateOptions = CommonEvaluateOptions & {
  questions?: never;
};

export type PerCallClassifierEvaluateOptions<QUESTIONS extends ClassifierQuestions> = CommonEvaluateOptions & {
  questions: QUESTIONS;
};

export type ConfiguredClassifierOptions<QUESTIONS extends ClassifierQuestions> = {
  id: string;
  model: EvaluationModelV4;
  questions: QUESTIONS;
};

export type PerCallClassifierOptions = {
  id: string;
  model: EvaluationModelV4;
  questions?: never;
};

export class Classifier<CONFIGURED_QUESTIONS extends ClassifierQuestions | undefined = undefined> {
  readonly id: string;
  readonly model: EvaluationModelV4;
  readonly questions: CONFIGURED_QUESTIONS;

  constructor(
    options: CONFIGURED_QUESTIONS extends ClassifierQuestions
      ? ConfiguredClassifierOptions<CONFIGURED_QUESTIONS>
      : PerCallClassifierOptions,
  ) {
    if (typeof options.id !== 'string' || options.id.trim().length === 0) {
      throw new TypeError('Classifier id must be a non-empty string.');
    }

    this.id = options.id;
    this.model = options.model;
    this.questions = options.questions as CONFIGURED_QUESTIONS;

    if (this.questions !== undefined) {
      validateQuestions(this.questions, this.model);
    }
  }

  async evaluate(
    options: CONFIGURED_QUESTIONS extends ClassifierQuestions
      ? ConfiguredClassifierEvaluateOptions
      : never,
  ): Promise<
    CONFIGURED_QUESTIONS extends ClassifierQuestions ? ClassifierResult<CONFIGURED_QUESTIONS> : never
  >;
  async evaluate<const QUESTIONS extends ClassifierQuestions>(
    options: CONFIGURED_QUESTIONS extends undefined ? PerCallClassifierEvaluateOptions<QUESTIONS> : never,
  ): Promise<ClassifierResult<QUESTIONS>>;
  async evaluate(
    options: ConfiguredClassifierEvaluateOptions | PerCallClassifierEvaluateOptions<ClassifierQuestions>,
  ): Promise<ClassifierResult<ClassifierQuestions>> {
    const questions = this.questions ?? ('questions' in options ? options.questions : undefined);
    if (questions === undefined) {
      throw new TypeError('Questions are required when the classifier is constructed without questions.');
    }

    validateState(options.state);
    validateQuestions(questions, this.model);
    validateMaxRetries(options.maxRetries);
    options.abortSignal?.throwIfAborted();

    const providerQuestions = toProviderQuestions(questions);
    const questionTypes = [...new Set(Object.values(questions).map(question => question.type))];
    const span = resolveCurrentSpan()?.createChildSpan({
      type: SpanType.CLASSIFIER_EVALUATION,
      name: `classifier evaluate: '${this.id}'`,
      attributes: {
        classifierId: this.id,
        modelId: this.model.modelId,
        provider: this.model.provider,
        questionCount: Object.keys(questions).length,
        questionTypes,
        maxRetries: options.maxRetries ?? 2,
      },
    });

    const startedAt = Date.now();
    let attemptCount = 0;

    try {
      const retry = retryWithExponentialBackoff({
        maxRetries: options.maxRetries ?? 2,
        abortSignal: options.abortSignal,
        shouldRetry: error => APICallError.isInstance(error) && error.isRetryable,
      });
      const providerResult = await retry(async () => {
        options.abortSignal?.throwIfAborted();
        attemptCount += 1;
        return this.model.doEvaluate({
          state: options.state,
          questions: providerQuestions,
          abortSignal: options.abortSignal,
          providerOptions: options.providerOptions,
        });
      });

      options.abortSignal?.throwIfAborted();
      validateProviderResult(questions, providerResult.answers, providerResult.rounding);

      const inputTokens = providerResult.usage?.inputTokens;
      const outputTokens = providerResult.usage?.outputTokens;
      const result: ClassifierResult<ClassifierQuestions> = {
        answers: providerResult.answers,
        usage: {
          inputTokens,
          outputTokens,
          totalTokens: (inputTokens ?? 0) + (outputTokens ?? 0),
        },
        warnings: providerResult.warnings,
        rounding: providerResult.rounding,
        providerMetadata: providerResult.providerMetadata,
        response: {
          ...providerResult.response,
          timestamp: providerResult.response?.timestamp ?? new Date(),
          modelId: providerResult.response?.modelId ?? this.model.modelId,
        },
      };

      span?.update({
        attributes: {
          attemptCount,
          retryCount: attemptCount - 1,
          durationMs: Date.now() - startedAt,
          inputTokens: result.usage.inputTokens,
          outputTokens: result.usage.outputTokens,
          totalTokens: result.usage.totalTokens,
        },
      });
      span?.end();
      return result;
    } catch (error) {
      span?.update({
        attributes: {
          attemptCount,
          retryCount: Math.max(0, attemptCount - 1),
          durationMs: Date.now() - startedAt,
          errorType: error instanceof Error ? error.name : typeof error,
        },
      });
      span?.error({
        error: error instanceof Error ? error : new Error(String(error)),
        endSpan: true,
      });
      throw error;
    }
  }
}

function toProviderQuestions(questions: ClassifierQuestions): Readonly<Record<string, EvaluationModelV4Question>> {
  return Object.fromEntries(
    Object.entries(questions).map(([questionId, question]) => [
      questionId,
      {
        ...question,
        instructions: question.instructions ?? questionId,
      },
    ]),
  );
}

function validateMaxRetries(maxRetries: number | undefined): void {
  if (maxRetries !== undefined && (!Number.isInteger(maxRetries) || maxRetries < 0)) {
    throw new TypeError('maxRetries must be a non-negative integer.');
  }
}

function validateState(state: unknown): asserts state is ClassifierState {
  validateJsonValue(state, 'state');
}

function validateQuestions(questions: ClassifierQuestions, model: EvaluationModelV4): void {
  if (!isPlainObject(questions) || Object.keys(questions).length === 0) {
    throw new TypeError('Questions must be a non-empty object.');
  }

  for (const [questionId, question] of Object.entries(questions)) {
    if (questionId.length === 0) {
      throw new TypeError('Question ids must be non-empty strings.');
    }
    if (!isPlainObject(question) || !['choice', 'score', 'boolean'].includes(question.type as string)) {
      throw new TypeError(`Question '${questionId}' has an invalid type.`);
    }
    if (!model.supportedQuestionTypes.includes(question.type)) {
      throw new EvaluationUnsupportedQuestionTypeError({
        questionId,
        questionType: question.type,
        provider: model.provider,
        modelId: model.modelId,
      });
    }

    if (question.instructions !== undefined) {
      validateJsonValue(question.instructions, `Question '${questionId}' instructions`);
    }

    if (question.type === 'choice') {
      if (!isPlainObject(question.criteria) || Object.keys(question.criteria).length === 0) {
        throw new TypeError(`Choice question '${questionId}' criteria must be a non-empty object.`);
      }
      for (const [choice, description] of Object.entries(question.criteria)) {
        if (choice.length === 0) {
          throw new TypeError(`Choice question '${questionId}' option names must be non-empty.`);
        }
        if (description !== null) validateJsonValue(description, `Choice question '${questionId}' criterion '${choice}'`);
      }
    } else if (question.type === 'score') {
      if (!Array.isArray(question.criteria) || question.criteria.length < 2) {
        throw new TypeError(`Score question '${questionId}' criteria must contain at least two levels.`);
      }
      question.criteria.forEach((description, index) => {
        if (description !== null) validateJsonValue(description, `Score question '${questionId}' criterion ${index}`);
      });
    } else if (question.criteria !== undefined) {
      if (!isPlainObject(question.criteria)) {
        throw new TypeError(`Boolean question '${questionId}' criteria must be an object.`);
      }
      for (const key of Object.keys(question.criteria)) {
        if (key !== 'true' && key !== 'false') {
          throw new TypeError(`Boolean question '${questionId}' criteria may only contain true and false.`);
        }
      }
      for (const [key, description] of Object.entries(question.criteria)) {
        if (description !== null && description !== undefined) {
          validateJsonValue(description, `Boolean question '${questionId}' criterion '${key}'`);
        }
      }
    }
  }
}

function validateProviderResult(
  questions: ClassifierQuestions,
  answers: Record<string, EvaluationModelV4Answer>,
  rounding?: { probabilityDecimals?: number; scoreDecimals?: number },
): void {
  if (!isPlainObject(answers)) throw new TypeError('The evaluation model returned invalid answers.');
  const questionIds = Object.keys(questions);
  const answerIds = Object.keys(answers);
  if (answerIds.length !== questionIds.length || answerIds.some(id => !(id in questions))) {
    throw new TypeError('The evaluation model must return exactly one answer per question.');
  }

  validateRounding(rounding);
  const probabilityTolerance = rounding?.probabilityDecimals === undefined ? 1e-6 : 0.5 * 10 ** -rounding.probabilityDecimals;
  const scoreTolerance = rounding?.scoreDecimals === undefined ? 1e-6 : 0.5 * 10 ** -rounding.scoreDecimals;

  for (const questionId of questionIds) {
    const question = questions[questionId]!;
    const answer = answers[questionId]!;
    if (!isPlainObject(answer) || answer.type !== question.type) {
      throw new TypeError(`Answer '${questionId}' does not match its question type.`);
    }

    if (answer.type === 'boolean') {
      validateProbability(answer.probability, `Boolean answer '${questionId}' probability`);
      continue;
    }

    if (answer.type === 'choice') {
      const choices = Object.keys((question as Extract<ClassifierQuestion, { type: 'choice' }>).criteria);
      if (!choices.includes(answer.choice)) {
        throw new TypeError(`Choice answer '${questionId}' selected an unknown option.`);
      }
      if (answer.probabilities !== undefined) {
        validateDistribution(answer.probabilities, choices, probabilityTolerance, questionId);
        const maximum = Math.max(...Object.values(answer.probabilities as Record<string, number>));
        if (answer.probabilities[answer.choice]! < maximum - probabilityTolerance) {
          throw new TypeError(`Choice answer '${questionId}' is not a highest-probability option.`);
        }
      }
      continue;
    }

    const levelCount = (question as Extract<ClassifierQuestion, { type: 'score' }>).criteria.length;
    if (!Number.isFinite(answer.score) || answer.score < 0 || answer.score > levelCount - 1) {
      throw new TypeError(`Score answer '${questionId}' is outside the question range.`);
    }
    if (answer.probabilities !== undefined) {
      const levels = Array.from({ length: levelCount }, (_, index) => String(index));
      validateDistribution(answer.probabilities, levels, probabilityTolerance, questionId);
      const mean = levels.reduce((sum, level) => sum + Number(level) * answer.probabilities![level]!, 0);
      if (Math.abs(mean - answer.score) > scoreTolerance + levelCount * probabilityTolerance) {
        throw new TypeError(`Score answer '${questionId}' does not match its probability-weighted mean.`);
      }
    }
  }
}

function validateRounding(rounding: { probabilityDecimals?: number; scoreDecimals?: number } | undefined): void {
  if (rounding === undefined) return;
  if (!isPlainObject(rounding)) throw new TypeError('Evaluation rounding metadata must be an object.');
  for (const [name, value] of Object.entries(rounding)) {
    if ((name !== 'probabilityDecimals' && name !== 'scoreDecimals') || !Number.isInteger(value) || value < 0) {
      throw new TypeError('Evaluation rounding precision must use non-negative integer decimal counts.');
    }
  }
}

function validateDistribution(
  probabilities: Record<string, number>,
  expectedKeys: string[],
  tolerance: number,
  questionId: string,
): void {
  if (!isPlainObject(probabilities)) {
    throw new TypeError(`Answer '${questionId}' probabilities must be an object.`);
  }
  const keys = Object.keys(probabilities);
  if (keys.length !== expectedKeys.length || keys.some(key => !expectedKeys.includes(key))) {
    throw new TypeError(`Answer '${questionId}' probabilities must contain the complete distribution.`);
  }
  let sum = 0;
  for (const value of Object.values(probabilities)) {
    validateProbability(value, `Answer '${questionId}' probability`);
    sum += value;
  }
  if (Math.abs(sum - 1) > 1e-6 + expectedKeys.length * tolerance) {
    throw new TypeError(`Answer '${questionId}' probabilities must sum to 1.`);
  }
}

function validateProbability(value: unknown, label: string): asserts value is number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) {
    throw new TypeError(`${label} must be a finite number between 0 and 1.`);
  }
}

function validateJsonValue(value: unknown, label: string, seen = new Set<object>()): void {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number') {
    if (Number.isFinite(value)) return;
    throw new TypeError(`${label} must contain only JSON-compatible values.`);
  }
  if (typeof value !== 'object') throw new TypeError(`${label} must contain only JSON-compatible values.`);
  if (seen.has(value)) throw new TypeError(`${label} must not contain circular references.`);
  seen.add(value);
  if (Array.isArray(value)) {
    for (const item of value) validateJsonValue(item, label, seen);
  } else if (isPlainObject(value)) {
    for (const item of Object.values(value)) validateJsonValue(item, label, seen);
  } else {
    throw new TypeError(`${label} must contain only JSON-compatible values.`);
  }
  seen.delete(value);
}

function isPlainObject(value: unknown): value is Record<string, any> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
