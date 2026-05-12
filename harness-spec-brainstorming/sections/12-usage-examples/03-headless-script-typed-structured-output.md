### 12.3 Headless script — typed structured output

A backend job calls the Harness directly without a UI. Uses `message` with a Zod schema for typed output.

```ts
import { z } from 'zod';
import { Harness } from '@mastra/core/harness/v1';

const harness = new Harness(config);
await harness.init();

const session = await harness.session({
  resourceId: 'cron:nightly-summarizer',
  threadId: { fresh: true },
});

const SummarySchema = z.object({
  title: z.string(),
  bullets: z.array(z.string()).max(5),
  sentiment: z.enum(['positive', 'neutral', 'negative']),
});

// `output` with `sync: true` uses the clean turn-boundary path in §3/§4.2.
const summary = await session.message({
  content: `Summarize this support ticket:\n\n${ticket.body}`,
  output: SummarySchema,
  sync: true,
  model: 'anthropic/claude-haiku-4-5', // per-call override
});

// summary is typed as z.infer<typeof SummarySchema> — no casting.
await db.summaries.insert({
  ticketId: ticket.id,
  title: summary.title,
  bullets: summary.bullets,
  sentiment: summary.sentiment,
});

await session.close();
```
