import { createStep } from '@mastra/core/workflows';

import { questionResultSchema } from '../../../contracts/answer.ts';
import { processQuestion } from '../../../processing/answers.ts';
import { ProcessingFailure } from '../../../processing/failure.ts';
import { draftQuestionInputSchema } from '../contracts.ts';
import type { DraftWorkflowRuntime } from '../runtime.ts';

export function createDraftQuestionStep(runtime: DraftWorkflowRuntime) {
  return createStep({
    id: 'draft-question',
    inputSchema: draftQuestionInputSchema,
    outputSchema: questionResultSchema,
    execute: async ({ inputData }) => {
      const session = runtime.sessions.get(inputData.runId);
      const question = session?.questions.find(candidate => candidate.id === inputData.questionId);
      if (!session || !question) throw new ProcessingFailure('STORAGE_FAILURE');

      const interpretation = session.interpretations.get(question.id);
      if (!interpretation) throw new ProcessingFailure('INVALID_MODEL_OUTPUT');

      return processQuestion(question, session.environment, interpretation);
    },
  });
}
