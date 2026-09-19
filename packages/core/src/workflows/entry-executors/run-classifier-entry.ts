import type {
  Classifier,
  ClassifierAnswers,
  ClassifierQuestions,
  ClassifierState,
  ClassifierUsage,
} from '../../classifier';
import { traverseMappingPath } from '../mapping-template';
import type { ClassifierStepEntry } from '../types';
import type { EntryExecuteContext } from './types';

export type ClassifierStepValues<QUESTIONS extends ClassifierQuestions> = {
  -readonly [KEY in keyof QUESTIONS]: QUESTIONS[KEY] extends { type: 'choice' }
    ? ClassifierAnswers<QUESTIONS>[KEY] extends { choice: infer CHOICE }
      ? CHOICE
      : never
    : QUESTIONS[KEY] extends { type: 'score' }
      ? number
      : QUESTIONS[KEY] extends { type: 'boolean' }
        ? number
        : never;
};

export type ClassifierStepOutput<QUESTIONS extends ClassifierQuestions> = {
  values: ClassifierStepValues<QUESTIONS>;
  answers: ClassifierAnswers<QUESTIONS>;
  usage: ClassifierUsage;
};

export async function runClassifierEntry<QUESTIONS extends ClassifierQuestions>(
  entry: ClassifierStepEntry,
  ctx: EntryExecuteContext,
): Promise<ClassifierStepOutput<QUESTIONS>> {
  let classifier = entry.classifier as Classifier<QUESTIONS> | undefined;
  if (!classifier) {
    try {
      classifier = ctx.mastra.getClassifierById(entry.classifierId) as Classifier<QUESTIONS> | undefined;
    } catch {
      throw new Error(
        `Classifier '${entry.classifierId}' not found for workflow step '${entry.id}'. Register it with Mastra or pass the classifier instance directly.`,
      );
    }
  }

  if (!classifier) {
    throw new Error(
      `Classifier '${entry.classifierId}' not found for workflow step '${entry.id}'. Register it with Mastra or pass the classifier instance directly.`,
    );
  }
  if (!classifier.questions) {
    throw new Error(
      `Classifier '${entry.classifierId}' for workflow step '${entry.id}' must be configured with questions.`,
    );
  }

  const state = await resolveClassifierState(entry.state, ctx);
  const result = await (classifier.evaluate as unknown as (options: {
    state: ClassifierState;
    abortSignal?: AbortSignal;
    maxRetries?: number;
    providerOptions?: Record<string, Record<string, unknown>>;
  }) => Promise<{ answers: ClassifierAnswers<QUESTIONS>; usage: ClassifierUsage }>)({
    state,
    abortSignal: ctx.abortSignal,
    maxRetries: entry.options?.maxRetries,
    providerOptions: entry.options?.providerOptions,
  });

  const values = Object.fromEntries(
    Object.entries(result.answers).map(([key, answer]) => [
      key,
      answer.type === 'choice' ? answer.choice : answer.type === 'score' ? answer.score : answer.probability,
    ]),
  ) as ClassifierStepValues<QUESTIONS>;

  return { values, answers: result.answers, usage: result.usage };
}

async function resolveClassifierState(
  state: ClassifierStepEntry['state'],
  ctx: EntryExecuteContext,
): Promise<ClassifierState> {
  if (state === undefined) return ctx.inputData as ClassifierState;
  if (typeof state === 'function') return state(ctx);

  const [root, ...segments] = state.path.split('.');
  const path = segments.join('.');
  switch (root) {
    case 'inputData':
      return traverseMappingPath(ctx.inputData, path, 'classifier state') as ClassifierState;
    case 'state':
      return traverseMappingPath(ctx.state, path, 'classifier state') as ClassifierState;
    case 'initData':
      return traverseMappingPath(ctx.getInitData(), path, 'classifier state') as ClassifierState;
    case 'stepResults': {
      const [stepId, ...stepPath] = segments;
      return traverseMappingPath(ctx.getStepResult(stepId!), stepPath.join('.'), 'classifier state') as ClassifierState;
    }
    default:
      throw new Error(
        `Invalid classifier state path '${state.path}'. Expected inputData, state, initData, or stepResults root.`,
      );
  }
}
