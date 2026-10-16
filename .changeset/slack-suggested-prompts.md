---
'@mastra/slack': patch
---

Add `suggestedPrompts` to the Slack provider and adapter config, and subscribe the default manifest to `assistant_thread_started` so those prompts are pinned when a user opens a new AI Assistant thread.

```ts
new SlackProvider({
  suggestedPrompts: {
    title: 'Try asking',
    prompts: [{ title: 'Summarize this channel', message: 'Summarize the last day of this channel' }],
  },
});
```
