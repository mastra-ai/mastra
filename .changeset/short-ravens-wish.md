---
'@mastra/core': minor
---

Added chat channel support to `Harness`, connecting a Harness-backed bot to chat platforms such as Slack. Inbound platform messages are routed into a Harness `Session` and the session's event stream is rendered back to the thread: streaming assistant replies edit a single message in place, tool calls render as cards that update to a result, and tool approvals post Approve/Deny buttons that resume the run on a click.

The thread-to-session mapping is automatic and Devin-style: a channel-root @mention starts a new session, replying in that thread continues the same session, and @mentioning elsewhere starts a fresh one. An opt-in `acknowledge` config adds a visible signal when a new session starts — a reaction on the triggering message and/or a "session started" message posted into the thread. It fires only on the first message of a session (never on continuations), is best-effort, and never blocks or delays the user's message. Both fields are off by default.

Configure channels directly on the Harness — when the Harness is hosted on a Mastra server, its channel webhook routes are registered automatically:

```typescript
import { Harness } from '@mastra/core/harness';
import { Mastra } from '@mastra/core';
import { createSlackAdapter } from '@mastra/slack';

const harness = new Harness({
  id: 'support',
  modes,
  channels: {
    adapters: {
      slack: createSlackAdapter({
        botToken: process.env.SLACK_BOT_TOKEN!,
        signingSecret: process.env.SLACK_SIGNING_SECRET!,
      }),
    },
    acknowledge: {
      reaction: 'eyes',
      sessionStartMessage: '🧵 Started a new session.',
    },
  },
});

// Webhook routes are registered automatically.
export const mastra = new Mastra({ harnesses: { support: harness } });
```

A standalone `HarnessChannels` class is also exported from `@mastra/core/channels` for advanced setups that manage the channel lifecycle manually.
