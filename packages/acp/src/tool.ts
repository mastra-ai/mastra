import type { JSONSchema7 } from 'json-schema';
import { createTool } from '@mastra/core/tools';

import { ACPConnection } from './connection';
import type { CreateACPToolOptions } from './types';

export function createACPTool(options: CreateACPToolOptions) {
  return createTool({
    id: options.id,
    description: options.description,
    inputSchema: {
      type: 'object',
      properties: {
        task: { type: 'string', description: 'The task to send to the ACP agent' },
      },
      required: ['task'],
    } satisfies JSONSchema7,
    outputSchema: {
      type: 'object',
      properties: {
        output: { type: 'string', description: 'The output of the ACP agent' },
      },
      required: ['output'],
    } satisfies JSONSchema7,
    suspendSchema: {
      type: 'object',
      properties: {
        permissionRequest: {
          type: 'object',
          properties: {
            title: { type: 'string', description: 'The title of the permission request' },
            options: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  optionId: { type: 'string', description: 'The option id to select' },
                  name: { type: 'string', description: 'The title of the permission request' },
                },
                required: ['optionId', 'name'],
              },
            },
          },
          required: ['title', 'options'],
        },
      },
      required: ['permissionRequest'],
    } satisfies JSONSchema7,
    resumeSchema: {
      anyOf: [
        {
          type: 'object',
          properties: {
            optionId: { type: 'string', description: 'The option id to select' },
            outcome: { const: 'selected', description: 'The outcome of the permission request' },
          },
        } satisfies JSONSchema7,
        {
          type: 'object',
          properties: {
            outcome: { const: 'cancelled', description: 'The outcome of the permission request' },
          },
        } satisfies JSONSchema7,
      ],
    } satisfies JSONSchema7,
    execute: async (inputData, context) => {
      const { task } = inputData as { task: string };
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
