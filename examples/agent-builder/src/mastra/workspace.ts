import { Workspace } from '@mastra/core/workspace';
import { DaytonaSandbox } from '@mastra/daytona';

export const workspace = new Workspace({
  id: 'github-workspace',
  sandbox: new DaytonaSandbox({
    timeout: 60 * 60 * 1000,
    env: {
      GITHUB_TOKEN: process.env.GITHUB_TOKEN || '',
    },
  }),
});
