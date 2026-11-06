---
'@mastra/connect': minor
---

Added `codeMode()` to the `tools()` resolver so agents can use connected tools through Code Mode. The agent writes one TypeScript program that calls the connected tools as functions, instead of calling each tool in its own step. This helps with tasks that fan out across many calls or providers.

```ts
import { tools } from '@mastra/connect';
import { LocalSandbox } from '@mastra/core/workspace';

const code = tools().codeMode({ sandbox: new LocalSandbox() });

const agent = new Agent({
  instructions: async ctx => ['You are helpful.', await code.instructions(ctx)],
  tools: code.tools,
  // ...
});
```

The functions available to the program follow the current connections on every request. Tools that need approval and `request_connection` stay direct agent tools, so the agent still waits for approval and can still pause on a connect prompt.

When many providers are connected, Code Mode lists only function names in the instructions and gives the agent a `search_functions` tool that returns the declarations it needs, so the instructions stay small. This turns on by itself above about 10,000 tokens of declarations; set `toolSearch: true` or `false` to choose.
