---
'@mastra/inngest': patch
---

Scope Inngest workflow cancellation to the run being cancelled. The workflow function registered its cancel event without a `match` expression, so cancelling one run cancelled every in-flight run of that function — and because all durable agents share a single function, one `cancel()` call tore down unrelated runs across the deployment while only the targeted run's snapshot was marked canceled.
