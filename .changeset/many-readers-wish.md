---
'@mastra/inngest': patch
---

Fixed bugs where createInngestAgent silently dropped per-call trust/context signals when starting or resuming a durable workflow:

- The `actor` signal was never forwarded at all, which could cause authorization checks that rely on `actor` (for example tenant/organization scoping) to fail incorrectly. `actor` is now forwarded on both the initial trigger and on resume, and `InngestAgentResumeOptions` gained an `actor` field so callers can re-supply it when resuming a suspended run.
- `resume()` had no way to refresh `requestContext` either — it only ever reused whatever was persisted in the suspended run's snapshot. `InngestAgentResumeOptions` now accepts a `requestContext`, which is merged over the persisted context (fresh values win), so callers can update context that changed while a run was suspended (for example a rotated token).

Both `@mastra/inngest`'s general Workflow API (`run.ts`) and createInngestAgent's durable-agent wrapper build these same event payloads independently, which is how `actor` and the resume-refresh behavior went out of sync in the first place. Both now share one implementation for building these fields, so a future addition can't silently diverge between the two the same way.
