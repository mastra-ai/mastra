---
'@mastra/evals': patch
---

Fixed extractToolResults and extractToolCalls in @mastra/evals to read tool invocations from V2 content.parts entries when the legacy toolInvocations field is absent. This prevents hallucination and tool-usage scorers from returning incorrect scores (all hallucinated / zero tool usage) when observable memory is enabled.
