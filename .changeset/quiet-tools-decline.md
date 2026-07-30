---
'@mastra/core': patch
---

Fixed `declineToolCall` / `declineToolCallGenerate` executing tools that were declined when approval was gated only by agent-level `requireToolApproval` (and the live policy was lost on resume). Resume now honors the outer approval suspend payload so declines short-circuit without running the tool. Fixes https://github.com/mastra-ai/mastra/issues/20470
