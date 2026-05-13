---
"@mastra/core": minor
"mastracode": minor
---

Added `GithubSignals`, a signal controller exported from `@mastra/core/signals`, for subscribing agent threads to GitHub pull request notifications. New subscriptions establish a silent baseline before polling, and notifications use compact GitHub-specific system reminder types so agents receive token-efficient context.

```ts
import { GithubSignals, ghSignals } from '@mastra/core/signals';

const github = new GithubSignals({ repo: 'mastra-ai/mastra' });

const agent = new Agent({
  id: 'code-agent',
  inputProcessors: [github.processor],
  // ...
});

github.addAgent(agent);
await github.init({ memory, resourceId: 'user_123' });

await agent.sendSignal(ghSignals.prSubscribe({ prNumber: 1234 }), {
  resourceId: 'user_123',
  threadId: 'thread_456',
});
```

MastraCode now wires `GithubSignals` into its code agent, explicitly rehydrates persisted subscriptions at startup, and renders GitHub CI, comment, and review reminders with GitHub-specific styling and structured PR/user metadata.
