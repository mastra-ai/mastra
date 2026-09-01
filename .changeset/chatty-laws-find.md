---
'@mastra/core': patch
'@mastra/observability': patch
---

Fixed agent run traces leaking open spans when a run ends abnormally. Errors, aborts, suspensions, tripwires, and prepare failures now close the whole span tree, and a span that ends early hands its still-open children to the nearest live ancestor. Exporters that wait for every span to finish (such as Datadog) no longer retain the trace and its payloads in memory forever.
