import { describe, expect, it } from 'vitest';

import { listAvailableClassifiersTool } from '../list-available-classifiers';

describe('listAvailableClassifiersTool', () => {
  it('returns predicate-scoped output paths', async () => {
    const result = await (listAvailableClassifiersTool as any).execute(
      {},
      {
        mastra: {
          listClassifiers: () => ({
            router: {
              questions: {
                route: {
                  type: 'choice',
                  instructions: 'Choose a route',
                  criteria: { billing: 'Billing', support: 'Support' },
                },
              },
            },
          }),
        },
      },
    );

    expect(result.classifiers).toEqual([
      {
        id: 'router',
        questions: [
          expect.objectContaining({
            id: 'route',
            valuePath: 'inputData.values.route',
            answerPath: 'inputData.answers.route',
          }),
        ],
        outputPaths: {
          values: 'inputData.values.<question>',
          answers: 'inputData.answers.<question>',
          usage: 'inputData.usage',
        },
      },
    ]);
  });
});
