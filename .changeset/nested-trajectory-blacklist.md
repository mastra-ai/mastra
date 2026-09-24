---
'@mastra/evals': patch
---

Fixed trajectory scoring so blacklisted and repeated tool calls inside nested agent and workflow steps now lower the score. Previously only top-level calls were checked. Fixes #24925.
