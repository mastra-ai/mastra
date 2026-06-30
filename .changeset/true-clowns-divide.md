---
'mastracode': patch
---

Added Mastra Code plugin support:

- Install, scaffold, configure, block, and auto-update plugins with local-change backups.
- Load plugin tools in all modes, including streaming progress and subagent-style rendering.
- Load bundled plugin commands, skills, and plugin-provided system instructions.

Example:

```ts
import { createTool, defineMastraCodePlugin, z } from 'mastracode/plugin';

export default defineMastraCodePlugin({
  id: 'acme.tools',
  tools: {
    echo: {
      tool: createTool({
        id: 'echo',
        inputSchema: z.object({ message: z.string() }),
        execute: async ({ message }) => ({ message }),
      }),
    },
  },
});
```
