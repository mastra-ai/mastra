---
'@mastra/github-signals': patch
---

Strip CodeRabbit-style internal machine-state blocks (and collapsed `<details>` sections) from PR comment bodies at ingestion, and stop persisting the full comment body in notification metadata (the truncated excerpt is retained). This prevents oversized bot payloads from bloating notifications and overflowing agent context windows.
