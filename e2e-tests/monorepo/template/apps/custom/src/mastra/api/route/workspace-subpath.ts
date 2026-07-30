import { registerApiRoute } from '@mastra/core/server';
// The app depends on @inner/subpath-mid only. @inner/subpath-only is reached transitively,
// and only through subpaths - it declares no "." export at all.
import { midValue } from '@inner/subpath-mid';

export const workspaceSubpathRoute = registerApiRoute('/workspace-subpath', {
  method: 'GET',
  handler: async c => {
    return c.json({ value: midValue });
  },
});
