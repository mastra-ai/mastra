---
'@mastra/core': patch
---

Added an `onSessionStart` hook to `AgentControllerChannels` config, called once per session after it is bound to its mapped chat thread and before the first message dispatches. Messages arriving while the hook is still running wait for it instead of dispatching on an unconfigured session.

```typescript
const controller = new AgentController({
  id: 'support-controller',
  agent,
  channels: {
    adapters: { slack: createSlackAdapter() },
    onSessionStart: async ({ session, thread }) => {
      await session.model.switch({ modelId: 'anthropic/claude-sonnet-4-6' });
    },
  },
});
```

A host can already name a channel session through `resolveResourceId`, but it never receives the `Session` object, which is created inside the channel machinery. Without a seam there, a host could only configure sessions it created itself, and channel-created sessions silently ran on the built-in default models. Hook errors are logged and swallowed so a session that cannot be configured still answers the message.
