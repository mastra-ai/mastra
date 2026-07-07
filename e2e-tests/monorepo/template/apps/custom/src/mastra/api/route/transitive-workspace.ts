import { registerApiRoute } from '@mastra/core/server';
import { valueA } from '@inner/transitive-a';

export const transitiveWorkspaceRoute = registerApiRoute('/transitive-workspace', {
  method: 'GET',
  handler: async c => {
    return c.json({ value: valueA });
  },
});
