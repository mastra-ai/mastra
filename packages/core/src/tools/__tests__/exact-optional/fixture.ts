import { z } from 'zod';
import { Mastra } from '../../../mastra';
import { createTool } from '../../tool';

const lookup = createTool({
  id: 'lookup',
  description: 'Returns a successful lookup result.',
  inputSchema: z.object({}),
  execute: async () => ({ ok: true }),
});

export const mastra = new Mastra({ tools: { lookup } });
