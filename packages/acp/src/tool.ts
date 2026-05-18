import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import { ACPConnection } from './connection';
import type { CreateACPToolOptions } from './types';

export function createACPTool(options: CreateACPToolOptions) {
  return createTool({
    id: options.id,
    description: options.description,
    inputSchema: z.object({
      task: z.string().describe('The task to send to the ACP agent'),
    }),
    outputSchema: z.object({
      output: z.string().describe('The output of the ACP agent'),
    }),
    suspendSchema: z.object({
      permissionRequest: z.object({
        title: z.string().describe('The title of the permission request'),
        options: z.array(
          z.object({
            optionId: z.string().describe('The option id to select'),
            name: z.string().describe('The title of the permission request'),
          }),
        ),
      }),
    }),
    resumeSchema: z.union([
      z.object({
        optionId: z.string().optional().describe('The option id to select'),
        outcome: z.literal('selected').optional().describe('The outcome of the permission request'),
      }),
      z.object({
        outcome: z.literal('cancelled').optional().describe('The outcome of the permission request'),
      }),
    ]),
    execute: async ({ task }, context) => {
      const workspace = await context?.mastra?.getWorkspace();
      const connection = new ACPConnection({
        ...options,
        workspace,
      });

      const output = await connection.prompt(task, context?.abortSignal);

      return { output };
    },
  });
}
