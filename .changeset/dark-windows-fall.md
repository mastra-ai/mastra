---
'@mastra/core': minor
---

Added `instructions.ts` as a code alternative to `instructions.md` for file-based agents. Use it when the prompt needs TypeScript, for example when it's built from shared constants or resolved per request.

Before, a computed prompt had to move into `config.ts`, splitting it away from the agent's other instructions:

```typescript
// src/mastra/agents/support/config.ts
import { agentConfig } from '@mastra/core/agent';

export default agentConfig({
  model: 'openai/gpt-5.6-sol',
  instructions: ({ requestContext }) => {
    const tier = requestContext.get('tier') ?? 'standard';
    return `You are a support agent. Treat this as a ${tier}-tier customer.`;
  },
});
```

Now it lives in its own file, next to `config.ts`:

```typescript
// src/mastra/agents/support/instructions.ts
import { agentInstructions } from '@mastra/core/agent';

export default agentInstructions(({ requestContext }) => {
  const tier = requestContext.get('tier') ?? 'standard';
  return `You are a support agent. Treat this as a ${tier}-tier customer.`;
});
```

The file default-exports a string, a system message, or a function returning one. `agentInstructions()` is an identity helper that only adds editor types.

**Precedence**

A function `config.instructions` still wins over both files, then `instructions.ts` wins over `instructions.md`, which still wins over a static `config.instructions`. Defining instructions in more than one place logs a warning naming both sources and which one wins.

One upgrade case needs a rename. If an agent directory already holds an unrelated `instructions.ts`, for example a helper that `config.ts` imports, Mastra now reads that file as the agent's instructions instead of its old source, and the build fails if the file has no default export.
