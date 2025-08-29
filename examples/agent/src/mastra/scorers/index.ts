import { createScorer, runExperiment } from '@mastra/core/scores';
import { z } from 'zod';
import type { ScorerRunInputForAgent, ScorerRunOutputForAgent } from '@mastra/core/scores';
import { evalAgent } from '../agents';

export const codeBasedScorer = createScorer<ScorerRunInputForAgent, ScorerRunOutputForAgent>({
  description: 'Code based scorer',
  name: 'codeBasedScorer',
}).generateScore(({ run }) => {
  const { input, output, groundTruth } = run;
  console.log(`~~~ Input ~~~~~`);
  console.log(`inputMessages`, JSON.stringify(input?.inputMessages, null, 2));
  console.log(`rememberedMessages`, JSON.stringify(input?.rememberedMessages, null, 2));
  console.log(`systemMessages`, JSON.stringify(input?.systemMessages, null, 2));
  console.log(`taggedSystemMessages`, JSON.stringify(input?.taggedSystemMessages, null, 2));

  console.log('\n\n');
  console.log(`~~~ Output ~~~~~`);
  console.log(`output`, JSON.stringify(output, null, 2));

  console.log('\n\n');
  console.log(`~~~ Ground Truth ~~~~~`);
  console.log(`groundTruth`, JSON.stringify(groundTruth, null, 2));

  const assistantResponse = run.output?.find(({ role }) => role === 'assistant')?.content;
  return assistantResponse?.includes(groundTruth) ? 1 : 0;
});

export const llmBasedScorer = createScorer<ScorerRunInputForAgent, ScorerRunOutputForAgent>({
  description: 'llm based scorer',
  name: 'llmBasedScorer',
})
  .preprocess({
    description: 'Analyze the output of the agent',
    outputSchema: z.object({
      statements: z.array(z.string()),
    }),
    createPrompt: ({ run }) => {
      const assistantResponse = run.output?.find(({ role }) => role === 'assistant')?.content;

      return `
            From extract all opinionated statements from the following text:
            ${assistantResponse ? assistantResponse : 'No assistant response'}

            Return the statements in following JSON format:
            { statements: [
                "Statement 1",
                "Statement 2",
                "Statement 3",
            ]}

            If there are no statements, return an empty array.
        `;
    },
  })
  .analyze({
    description: 'Analyze the statements',
    outputSchema: z.object({
      statements: z.array(
        z.object({
          statement: z.string(),
          isOpinionated: z.boolean(),
        }),
      ),
    }),
    createPrompt: ({ results }) => {
      const statements = results.preprocessStepResult.statements;

      return `
            Analyze the following statements:
            ${statements.join('\n')}

            Return the statements in following JSON format:
            { statements: [
                { statement: "Statement 1", isOpinionated: true },
                { statement: "Statement 2", isOpinionated: false },
                { statement: "Statement 3", isOpinionated: true },
            ]}

            If there are no statements, return an empty array.
        `;
    },
  })
  .generateScore(({ results }) => {
    const statements = results.analyzeStepResult.statements;

    return statements.reduce((acc, statement) => {
      return acc + (statement.isOpinionated ? 1 : 0);
    }, 0);
  });

const result = await runExperiment({
  target: evalAgent,
  scorers: [codeBasedScorer],
  data: [{ input: 'Weather in seattle', groundTruth: 'The weather in seattle is sunny' }],
  onItemComplete: ({ item, targetResult, scorerResults }) => {
    // item is the the data row for example { input: 'Weather in seattle', groundTruth: 'The weather in seattle is sunny' }
    // targetResult is the result of the agent
    // scorerResults is the results of the scorers
  },
});

// console.log(result);

//     describe('test suite', async () => {
//         it('should run the experiment', async () => {
//             const result = await runExperiment({
//                 target: evalAgent,
//                 scorers: [codeBasedScorer],
//                 data: [
//                     { input: 'Weather in seattle', groundTruth: 'The weather in seattle is sunny' },
//                 ],
//                 onItemComplete: ({ scorerResults }) => {
//                     expect(scorerResults.codeBasedScorer).toBe(1);
//                 }
//             })

//             expect(result.scores.codeBasedScorer).toBe(1);
//             // result.scores has the average score for each scorer
//         })
//     })
