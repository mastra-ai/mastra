import { z } from 'zod';

import { createTool } from '../tools';

import { OpenAPIToolset } from './openapi-toolset';

export class TestToolset extends OpenAPIToolset {
  readonly name = 'TEST';
  readonly logoUrl = '/logo-url';
  readonly categories = ['test-integration'];
  readonly description = 'This is a test integration';
  readonly tools = {
    testTool: createTool({
      id: 'Test integration tool',
      inputSchema: z.object({}),
      description: 'This is a test integration tol',
      execute: async () => {
        return { message: 'Executed successfully' };
      },
    }),
  } as const;
}

export class TestIntegration {
  getStaticTools() {
    return new TestToolset().tools;
  }
}
