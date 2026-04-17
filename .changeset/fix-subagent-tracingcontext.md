---
"@mastra/core": patch
---

Fixed `tracingContext` not being propagated to subagent's `stream()` call in `createSubagentTool`. This caused all nested spans from subagents to be missing in Langfuse and other OTel exporters, breaking the expected parent → child relationship in trace UIs. Fixes #15461
