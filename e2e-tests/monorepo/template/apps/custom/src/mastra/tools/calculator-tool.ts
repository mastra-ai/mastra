import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { roundToOneNumber } from '@inner/hello-world';
import { toPath } from 'unicorn-magic';

export function calculate(a: number, b: number) {
  return a + b;
}

export const calculatorTool = createTool({
  id: 'calculator',
  description: `A tool that sums up ${roundToOneNumber(2)} numbers`,
  inputSchema: z.object({
    a: z.number(),
    b: z.number(),
  }),
  execute: async input => {
    const { a, b } = input;

    // Only exists if exports map resolves with node condition
    // @see https://github.com/sindresorhus/unicorn-magic/blob/main/package.json#L15
    console.log(toPath);

    return calculate(a, b);
  },
});
