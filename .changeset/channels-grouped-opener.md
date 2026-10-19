---
'@mastra/core': patch
---

Channel streaming: text the agent writes before its first tool call now posts as its own message in `toolDisplay: 'grouped'` mode. An opening acknowledgement lands above the Thinking Steps widget instead of under it.

The plan widget in `'grouped'` and `'timeline'` modes is quieter. The header is a fixed "Working…" label and no longer echoes the current tool. Each task row shows the tool's `description` argument (first line only) when it has one, and falls back to `toolName firstArg` otherwise.

Grouped mode is an adapter option on the channel provider:

```ts
import { Mastra } from '@mastra/core';
import { SlackProvider } from '@mastra/slack';

export const mastra = new Mastra({
  channels: {
    slack: new SlackProvider({
      refreshToken: process.env.SLACK_APP_CONFIG_REFRESH_TOKEN,
      toolDisplay: 'grouped',
    }),
  },
});
```

`@mastra/core/processors` now exports `REPROCESS_PART_KEY` and `FLUSH_HELD_PARTS_KEY`, so output processors outside core can emit a second part for one input (return one, stash the other for the runner to re-drive) the same way `BatchPartsProcessor` does:

```ts
import { REPROCESS_PART_KEY } from '@mastra/core/processors';
import type { Processor, ProcessOutputStreamArgs } from '@mastra/core/processors';
import type { ChunkType } from '@mastra/core/stream';

// Appends a trailer to each text block: on `text-end`, return a final
// `text-delta` and stash the `text-end` so the runner re-drives it next.
export class TrailerProcessor implements Processor {
  readonly id = 'trailer';

  async processOutputStream({ part, state }: ProcessOutputStreamArgs): Promise<ChunkType> {
    if (part.type !== 'text-end') return part;
    state[REPROCESS_PART_KEY] = part;
    return { type: 'text-delta', runId: part.runId, from: part.from, payload: { id: part.payload.id, text: ' ↗' } };
  }
}
```
