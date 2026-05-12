---
"@mastra/core": minor
"mastracode": minor
---

Added `GithubSignals`, a signal controller exported from `@mastra/core/signals`, for subscribing agent threads to GitHub pull request notifications.

```ts
import { GithubSignals, ghSignals } from '@mastra/core/signals';

const github = new GithubSignals({ repo: 'mastra-ai/mastra' });

const agent = new Agent({
  id: 'code-agent',
  inputProcessors: [github.processor],
  // ...
});

github.addAgent(agent);

await agent.sendSignal(ghSignals.prSubscribe({ prNumber: 1234 }), {
  resourceId: 'user_123',
  threadId: 'thread_456',
});
```

MastraCode now wires `GithubSignals` into its code agent so threads can receive GitHub PR CI failure and review/comment notifications.
