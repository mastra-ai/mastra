import type { GetToolResponse } from '@mastra/client-js';
import { stringify } from 'superjson';

/** A tool shaped like the API returns it: schemas are superjson-stringified JSON Schema. */
export const refundUserTool: GetToolResponse = {
  id: 'refundUser',
  description: 'Refund a user a dollar amount.',
  inputSchema: stringify({
    type: 'object',
    properties: {
      user: { type: 'string', description: 'The user to refund' },
      amount: { type: 'number', description: 'The refund amount in dollars' },
    },
    required: ['user', 'amount'],
  }),
  outputSchema: stringify({
    type: 'object',
    properties: { refundId: { type: 'string' }, newBalance: { type: 'number' } },
    required: ['refundId', 'newBalance'],
  }),
};
