---
'@mastra/core': minor
---

Added channel support to the Harness, so you can run a Harness inside a messaging platform like Slack as a full UI — a peer of the terminal interface.

Where an Agent channel is a thin pipe to a single agent loop, a Harness channel is the interface to the Harness itself. Each conversation drives a durable per-resource Session, and replies (including streamed text and tool-approval cards) render from that session's event stream — the same contract the terminal UI consumes. V1 covers messaging and tool approvals.

**Usage**

```ts
import { Harness } from '@mastra/core/harness';
import { createSlackAdapter } from '@chat-adapter/slack';

const harness = new Harness({
  id: 'coding-harness',
  modes: [{ id: 'build', defaultModelId: 'openai/gpt-5.5' }],
  channels: {
    adapters: { slack: createSlackAdapter() },
  },
});

// Or bind later:
harness.setChannels(channels);
harness.getChannels();
```

The Agent channel path is unchanged.
