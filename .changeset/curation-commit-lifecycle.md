---
"@mastra/memory": patch
---

Count every successful observational-memory knowledge commit toward `curationCadence`, not just synchronous observations. Explicit buffering, background async buffering, end-of-turn idle buffering, and finalization paths now enter the same post-commit cadence accounting, so knowledge captured on a thread that never receives another user turn can still reach the curator. Direct `beginTurn()` calls can now pass `requestContext` through to idle buffering, preserving scoped subconscious capture. Failed, skipped, and activation-only cycles still count nothing, and curation stays fire-and-forget so its failure cannot fail observation or buffering. A successful commit is accounted before an `onObservationEnd` hook error is propagated.

Cadence is event-driven accounting evaluated after a successful commit: it is not a timer, poller, cron, or durable scheduler, it does not wake an idle process, and the counter is advisory rather than atomic - deployments using cadence with concurrent buffering may curate somewhat more often. It remains off by default.
