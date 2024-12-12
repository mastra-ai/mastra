import { z } from 'zod';

import { createTool } from '../tools';

import { OpenAPIToolset } from './openapi-toolset';

export class TestIntegration extends OpenAPIToolset {
  readonly name = 'TEST';
  readonly logoUrl = '/logo-url';
  readonly categories = ['test-integration'];
  readonly description = 'This is a test integration';
  readonly tools = {
    testTool: createTool({
      label: 'Test integration tool',
      schema: z.object({}),
      description: 'This is a test integration tol',
      executor: async () => {
        return { message: 'Executed successfully' };
      },
    }),
  } as const;
}
