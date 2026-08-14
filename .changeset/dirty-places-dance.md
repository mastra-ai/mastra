---
'@mastra/inngest': patch
---

Fixed createInngestAgent silently dropping per-call trust and context signals on durable start/resume. Trigger and resume events now share one payload builder with InngestRun, so actor is forwarded on both paths and resume can merge a fresh requestContext over the persisted snapshot (Fixes #19428).

**Example**

\`\`\`ts
await inngestAgent.resume(runId, { approved: true }, { actor, requestContext });
\`\`\`
