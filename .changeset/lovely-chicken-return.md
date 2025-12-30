---
'@mastra/ai-sdk': patch
'@mastra/react': patch
'@mastra/core': patch
---

Fixed agent network not returning text response when routing agent handles requests without delegation.

**What changed:**
- Agent networks now correctly stream text responses when the routing agent decides to handle a request itself instead of delegating to sub-agents, workflows, or tools
- Added fallback in transformers to ensure text is always returned even if core events are missing

**Why this matters:**
Previously, when using `toAISdkV5Stream` or `networkRoute()` outside of the Mastra Studio UI, no text content was returned when the routing agent handled requests directly. This fix ensures consistent behavior across all API routes.

Fixes #11219
