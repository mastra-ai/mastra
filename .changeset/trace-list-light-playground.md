---
'@mastra/playground-ui': patch
---

Improved the Observability traces list, which was downloading every trace's full prompt and response just to render a 100-character preview. The list, its live-tail polling and its periodic refresh now request a lightweight projection, and the preview column reads a short `inputPreview` field instead of the full input.

Measured against ClickHouse with 400 agent-run traces, one 25-row page dropped from 506 KB to 10.6 KB, and the database read for that page dropped from 7.83 MB to 0.13 MB. Backends without a dedicated lightweight query still get the smaller response, just not the smaller read.
