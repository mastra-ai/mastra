---
'@mastra/inngest': patch
---

Fixed bugs where createInngestAgent silently dropped per-call trust/context signals when starting or resuming a durable workflow:

- The `actor` signal was never forwarded at all, which could cause authorization checks that rely on `actor` (for example tenant/organization scoping) to fail incorrectly. `actor` is now forwarded on both the initial trigger and on resume, and `InngestAgentResumeOptions` gained an `actor` field so callers can re-supply it when resuming a suspended run.
- `resume()` had no way to refresh `requestContext` either — it only ever reused whatever was persisted in the suspended run's snapshot. `InngestAgentResumeOptions` now accepts a `requestContext`, which is merged over the persisted context (fresh values win), so callers can update context that changed while a run was suspended (for example a rotated token).

Supply fresh trust and context values when resuming:

```ts
await inngestAgent.resume(runId, { approved: true }, { actor, requestContext });
```
