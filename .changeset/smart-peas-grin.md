---
'@mastra/slack': minor
---

Added `textDisplay` to the Slack provider and adapter config. Set `textDisplay: 'hidden'` to keep the agent's reply text out of Slack threads, for example when the agent replies through a tool. Tool display, approval prompts, errors and typing status still show.

```ts
new SlackProvider({ textDisplay: 'hidden' });
```
