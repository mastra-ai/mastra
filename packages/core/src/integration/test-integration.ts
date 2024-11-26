import { z } from 'zod';
import { Integration } from '.';
import { createTool } from '../tools';

export class TestIntegration extends Integration {
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
