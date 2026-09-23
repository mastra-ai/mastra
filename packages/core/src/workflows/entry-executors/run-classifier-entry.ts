import type {
  Classifier,
  ClassifierAnswers,
  ClassifierQuestions,
  ClassifierState,
  ClassifierUsage,
} from '../../classifier';
import type { ClassifierStepEntry } from '../types';
import type { EntryExecuteContext } from './types';

export type ClassifierStepOutput<QUESTIONS extends ClassifierQuestions> = {
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

  const result = await (
    classifier.evaluate as unknown as (options: {
      state: ClassifierState;
      abortSignal?: AbortSignal;
      maxRetries?: number;
      providerOptions?: Record<string, Record<string, unknown>>;
    }) => Promise<{ answers: ClassifierAnswers<QUESTIONS>; usage: ClassifierUsage }>
  )({
    state: ctx.inputData as ClassifierState,
    abortSignal: ctx.abortSignal,
    maxRetries: entry.options?.maxRetries,
    providerOptions: entry.options?.providerOptions,
  });

  return { answers: result.answers, usage: result.usage };
}
