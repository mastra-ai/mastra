import { Workspace } from '@mastra/core/workspace';
import { E2BSandbox } from '@mastra/e2b';

export const workspace = new Workspace({
  id: `github-workspace-again-${Date.now()}`,
  sandbox: new E2BSandbox({
    id: `github-sandbox-again-${Date.now()}`,
    timeout: 60 * 60 * 1000,
    env: {
      GIT_TOKEN: process.env.GIT_TOKEN || '',
      GIT_USERNAME: process.env.GIT_USERNAME || '',
      GIT_EMAIL: process.env.GIT_EMAIL || '',
      GITHUB_TOKEN: process.env.GITHUB_TOKEN || '',
    },
  }),
});
