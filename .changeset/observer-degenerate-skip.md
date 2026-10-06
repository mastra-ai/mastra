---
'@mastra/memory': patch
---

Fixed Observational Memory degenerate-output detection so very long lines are truncated and retained, repeated short lines share the existing bounded budget, and genuinely repetitive output remains rejected.

Fixes #24354.
