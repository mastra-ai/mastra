import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

export const rollDiceTool = createTool({
  id: 'roll-dice',
  description: 'Roll one or more six-sided dice and return the results',
  inputSchema: z.object({
    count: z.number().int().min(1).max(10).default(1).describe('How many dice to roll'),
  }),
  outputSchema: z.object({
    rolls: z.array(z.number()),
    total: z.number(),
  }),
  execute: async input => {
    const rolls = Array.from({ length: input.count }, () => 1 + Math.floor(Math.random() * 6));
    return { rolls, total: rolls.reduce((a, b) => a + b, 0) };
  },
});
