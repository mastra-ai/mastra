---
'@mastra/core': minor
---

Added buttons to paused tools in Slack, Telegram and Teams threads. A tool that pauses with a `channelCard` in its suspend payload now shows that card in the thread, and a click on a `toolResumeButton()` resumes the tool with `{ action }`. The tool can pause again with a new card for multi-step flows, and the clicked card updates in place. Before, a paused tool left the thread stuck with nothing to click.

`getChannelRun(requestContext)` tells a tool which thread it runs in, who clicked (or sent the message), and that user's resource ID, so the tool can check the clicker owns the conversation before acting for them.

```ts
import { getChannelRun, toolResumeButton } from '@mastra/core/channels';
import { Actions, Card } from 'chat';

execute: async (input, context) => {
  const action = context.agent?.resumeData?.action;
  if (action === 'confirm') return 'confirmed';
  if (action === 'cancel') return 'cancelled';
  const run = getChannelRun(context.requestContext); // { platform, thread, actor, actorResourceId }
  const toolCallId = context.agent!.toolCallId;
  await context.agent!.suspend({
    channelCard: Card({
      title: 'Ready to deploy?',
      children: [
        Actions([
          toolResumeButton({ toolCallId, action: 'confirm', label: 'Deploy', style: 'primary' }),
          toolResumeButton({ toolCallId, action: 'cancel', label: 'Cancel' }),
        ]),
      ],
    }),
  });
};
```

Output processors on `Agent` now also receive `tool-call-suspended` chunks, as they already did on durable and evented agents.
