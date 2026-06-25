---
'@mastra/core': patch
---

Fixed memory exhaustion during tool-approval workflows with large tool payloads.

Tool-approval snapshots now stay significantly smaller — large tool results (e.g. Figma exports) are no longer duplicated across the snapshot, and message history no longer grows quadratically with each approval cycle. This prevents Node OOM crashes in long-running approval flows. Snapshots written by older versions still resume without changes.

Fixes [#17738](https://github.com/mastra-ai/mastra/issues/17738).
