---
'@mastra/code-sdk': minor
---

Added hooks for hosts that run Mastra Code's background shells in their own sessions.

- `createBackgroundNoticeDelivery` takes optional `resolveSession` and `wakeRequestContext` hooks, for hosts that find sessions by their own ids or wake runs with an identity the session doesn't carry. `resolveSession` returning `null` drops a notice; `undefined` holds it until a session runs the thread. An optional `resolveTarget` hook updates where a notice goes on every attempt, held ones included, for hosts that move threads between resources.
- `backgroundWorkGuidance()` returns the prompt guidance on background shells, for hosts that turn background tools on per session.

```ts
import { createBackgroundNoticeDelivery } from '@mastra/code-sdk/agents/background-completion';
import { backgroundWorkGuidance } from '@mastra/code-sdk/agents/prompts/tool-guidance';

const delivery = createBackgroundNoticeDelivery(() => controller, {
  // `sessionIdForThread` and `ownerRequestContext` stand for your host's own lookups.
  resolveSession: async ({ threadId }) => controller.getSession(sessionIdForThread(threadId)),
  wakeRequestContext: async (_session, target) => ownerRequestContext(target),
});
const instructions = backgroundWorkGuidance();
```

Background shells stopped through the sandbox's process manager, for example by a host's HTTP kill route, no longer send the agent an exit notice. A host that shares one exit dispatcher across several sandboxes no longer loses an exit notice when an agent kills a process with the same PID in another sandbox, or when two threads reuse a tool call id.
