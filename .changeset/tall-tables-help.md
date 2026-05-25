---
'@mastra/observability': patch
---

Cloud and Mastra Platform exporters now emit `ObservabilityDropEvent`s (with `reason: 'auth-cooldown'`) when events are dropped during an authentication-failure cooldown. Consumers wired to the observability bus's `emitDropEvent` callback (see PR #16111) can now observe these drops per signal (tracing, log, metric, score, feedback) instead of having them silently discarded.
