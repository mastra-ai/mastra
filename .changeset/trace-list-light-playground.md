---
'@mastra/playground-ui': patch
---

Improved the Observability traces list, which was downloading every trace's full prompt and response just to render a 100-character preview. The list, its live-tail polling and its periodic refresh now request a lightweight projection, and the preview column reads a short `inputPreview` field instead of the full input.

Measured against ClickHouse with 400 agent-run traces, one 25-row page dropped from 506 KB to 10.6 KB.
