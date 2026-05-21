import { Workspace } from '@mastra/core/workspace';
import { E2BSandbox } from '@mastra/e2b';

export const workspace = new Workspace({
  id: 'github-workspace',
  sandbox: new E2BSandbox({
    timeout: 60 * 60 * 1000,
    env: {
      GITHUB_TOKEN: process.env.GITHUB_TOKEN || '',
    },
  }),
});
