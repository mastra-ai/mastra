import { compileSchema } from '@internal/types-builder/compile-zod';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod/v4';

import { ACPToolSession } from './session';
import type { CreateACPToolOptions } from './types';

export function createACPTool(options: CreateACPToolOptions) {
  const session = new ACPToolSession(options);

  return createTool({
    id: options.id,
    description: options.description,
    inputSchema: compileSchema(
      z.object({
        task: z.string().describe('The task to send to the ACP agent'),
      }),
    ),
    outputSchema: compileSchema(
      z.object({
        output: z.string().describe('The output of the ACP agent'),
      }),
    ),
    suspendSchema: compileSchema(
      z.object({
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
    ),
    resumeSchema: compileSchema(
      z.union([
        z.object({
          optionId: z.string().optional().describe('The option id to select'),
          outcome: z.literal('selected').optional().describe('The outcome of the permission request'),
        }),
        z.object({
          outcome: z.literal('cancelled').optional().describe('The outcome of the permission request'),
        }),
      ]),
    ),
    execute: async ({ task }, context) => {
      const workspace = await context?.mastra?.getWorkspace();
      const connection = session.getConnection(workspace);
      const output = await connection.prompt(task, context?.abortSignal);

      return { output };
    },
  });
}
