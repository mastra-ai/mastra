---
'@mastra/playground-ui': patch
---

Improved the Observability traces list, which was downloading every trace's full prompt and response just to render a 100-character preview. The list now transfers only what it renders, so it loads far less data before a trace is opened and stays fast as traces grow. Measured against ClickHouse with 400 agent-run traces, one 25-row page dropped from 506 KB to 10.6 KB.
