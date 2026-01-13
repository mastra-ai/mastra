import { registerApiRoute } from '@mastra/core/server';
// Test directory import - importing from a folder with index.ts
import { bold, colorful } from '@inner/hello-world/shared';

export const directoryImportRoute = registerApiRoute('/directory-import', {
  method: 'GET',
  handler: async c => {
    return c.json({
      bold: bold('test'),
      colorful: colorful('test'),
    });
  },
});
