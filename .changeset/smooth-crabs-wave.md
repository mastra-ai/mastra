---
'@mastra/core': minor
---

Add completion validation to agent networks using custom scorers

You can now validate whether an agent network has completed its task by passing MastraScorers to `agent.network()`. When validation fails, the network automatically retries with feedback injected into the conversation.

**Example: Creating a scorer to verify test coverage**

```ts
import { createScorer } from '@mastra/core/evals';
import { z } from 'zod';

// Create a scorer that checks if tests were written
const testsScorer = createScorer({
  id: 'tests-written',
  description: 'Validates that unit tests were included in the response',
  type: 'agent',
}).generateScore({
  description: 'Return 1 if tests are present, 0 if missing',
  outputSchema: z.number(),
  createPrompt: ({ run }) => `
    Does this response include unit tests?
    Response: ${run.output}
    Return 1 if tests are present, 0 if not.
  `,
});

// Use the scorer with agent.network()
const stream = await agent.network('Implement a fibonacci function with tests', {
  completion: {
    scorers: [testsScorer],
    strategy: 'all', // all scorers must pass (score >= 0.5)
  },
  maxSteps: 3,
});
```

**What this enables:**

- **Programmatic completion checks**: Define objective criteria for task completion instead of relying on the default LLM-based check
- **Automatic retry with feedback**: When a scorer returns `score: 0`, its reason is injected into the conversation so the network can address the gap on the next iteration
- **Composable validation**: Combine multiple scorers with `strategy: 'all'` (all must pass) or `strategy: 'any'` (at least one must pass)

This replaces guesswork with reliable, repeatable validation that ensures agent networks produce outputs meeting your specific requirements.
