import { registerApiRoute } from '@mastra/core/server';
import { rootValue } from '@inner/subpath-only';
import { valueA } from '@inner/transitive-a';

/** App-local suffix used by the workspace HMR regression test. */
const APP_HMR_SUFFIX = 'App value is BEFORE.';

export const transitiveWorkspaceRoute = registerApiRoute('/transitive-workspace', {
  method: 'GET',
  handler: async c => {
    return c.json({ value: valueA, root: rootValue, app: APP_HMR_SUFFIX });
  },
});
