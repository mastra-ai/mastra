---
'@mastra/core': patch
---

Fixed AgentController dropping streamed assistant text and reasoning after page reload. Text and reasoning deltas that arrive without a seeded part (for example after a mid-stream step rotation) are now folded into the message instead of being silently discarded. Fixes #22712
