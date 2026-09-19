/**
 * Sub-agent tool: list classifiers the workflow-builder can reference in
 * classifier entries of a Dynamic Workflow graph. Read-only.
 */
import type { ClassifierQuestions } from '@mastra/core/classifier';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

function describeQuestions(questions: ClassifierQuestions | undefined) {
  if (!questions) return undefined;

  return Object.entries(questions).map(([id, question]) => ({
    id,
    type: question.type,
    instructions: question.instructions,
    choices: question.type === 'choice' ? Object.keys(question.criteria) : undefined,
    criteria: question.criteria,
    valuePath: `values.${id}`,
    answerPath: `answers.${id}`,
  }));
}

export const listAvailableClassifiersTool = createTool({
  id: 'list-available-classifiers',
  description:
    'Returns configured classifiers registered on the Mastra instance. The ids returned here are the only valid values for `{ type: "classifier", classifierId }`. Each row includes question metadata and stable output paths for routing with conditional entries.',
  inputSchema: z.object({}),
  outputSchema: z.object({
    classifiers: z.array(
      z.object({
        id: z.string(),
        questions: z
          .array(
            z.object({
              id: z.string(),
              type: z.enum(['choice', 'score', 'boolean']),
              instructions: z.any().optional(),
              choices: z.array(z.string()).optional(),
              criteria: z.any().optional(),
              valuePath: z.string(),
              answerPath: z.string(),
            }),
          )
          .optional(),
        outputPaths: z.object({
          values: z.string(),
          answers: z.string(),
          usage: z.string(),
        }),
      }),
    ),
  }),
  execute: async (_input, { mastra }) => {
    if (!mastra) throw new Error('list-available-classifiers requires a Mastra context.');
    const all =
      (mastra as { listClassifiers?: () => Record<string, { questions?: ClassifierQuestions }> | undefined })
        .listClassifiers?.() ?? {};

    return {
      classifiers: Object.entries(all)
        .filter(([, classifier]) => classifier.questions !== undefined)
        .map(([id, classifier]) => ({
          id,
          questions: describeQuestions(classifier.questions),
          outputPaths: {
            values: 'values.<question>',
            answers: 'answers.<question>',
            usage: 'usage',
          },
        })),
    };
  },
});
