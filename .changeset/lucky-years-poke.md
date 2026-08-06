---
'@mastra/core': minor
'@mastra/deployer': minor
'mastra': patch
---

**Added file-based schedules for agents**

File-based agents can now declare recurring tasks in a `schedules/` directory next to their tools and skills. Mastra registers them into schedule storage at startup, so a scheduled agent no longer needs any runtime registration code.

Each file is one schedule: a cron expression plus exactly one execution mode. Prompt mode runs the owning agent with a fixed message.

```typescript
// src/mastra/agents/support/schedules/heartbeat.ts
import { defineSchedule } from '@mastra/core/agent';

export default defineSchedule({
  cron: '*/5 * * * *',
  prompt: 'Check system health and report any failures.',
});
```

Handler mode computes the fire when it triggers, and returning `null` skips it.

```typescript
// src/mastra/agents/support/schedules/billing/sweep.ts
import { defineSchedule } from '@mastra/core/agent';

export default defineSchedule({
  cron: '0 3 * * *',
  handler: async () => {
    const overdue = await findOverdueInvoices();
    if (overdue.length === 0) return null;
    return { prompt: `Chase ${overdue.length} overdue invoices.` };
  },
});
```

A schedule's id is its path under `schedules/` with the extension stripped, so `billing/sweep.ts` becomes `billing/sweep` and stays stable across builds. Editing a cron patches the stored schedule and recomputes its next fire time, deleting the file deletes the schedule, and pausing a schedule through the API survives a redeploy. Schedules created with `mastra.schedules.create(...)` are in a separate namespace and are never touched by this sync.

A schedule can also be a Markdown file, using cron frontmatter with the document body as the prompt.

```text
// src/mastra/agents/support/schedules/cleanup.md
---
cron: "0 3 * * *"
---

Review tickets untouched for 30 days and close the ones that are resolved.
```

Declaring a schedule is enough to start the scheduler. Schedules are supported on root agents only; a `schedules/` directory under `subagents/` fails the build, because the scheduler cannot resolve a subagent as a run target.

`defineSchedule` is exported from both `@mastra/core/agent` and `@mastra/core/schedules`, so authoring a file-based agent needs a single import path.

Build and dev support the same convention: schedules are discovered at build time, Markdown schedules fail the build with a message naming the file when the cron is missing, the body is empty, the frontmatter has an unknown field, or the YAML is unparseable. That last case has its own message because a leading `*` is a YAML alias, so `cron: */5 * * * *` needs quoting. The dev server rebuilds when a Markdown schedule changes.
