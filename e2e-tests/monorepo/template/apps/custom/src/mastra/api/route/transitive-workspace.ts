import { registerApiRoute } from '@mastra/core/server';
import { valueA } from '@inner/transitive-a';

/** App-local suffix used by the workspace HMR regression test. */
const APP_HMR_SUFFIX = 'App value is BEFORE.';

export const transitiveWorkspaceRoute = registerApiRoute('/transitive-workspace', {
  method: 'GET',
  handler: async c => {
    return c.json({ value: valueA, app: APP_HMR_SUFFIX });
  },
});
