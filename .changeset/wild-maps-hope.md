---
'@mastra/core': patch
---

Fixed sub-agents in Agent Networks receiving completion check feedback messages in their conversation context. Previously, when a completion check failed, the feedback message (containing text like '#### Completion Check Results') was being passed to sub-agents on subsequent iterations, causing them to get confused and potentially mimic routing agent responses instead of focusing on their actual task. Fixes #12224
