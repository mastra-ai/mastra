---
'@mastra/client-js': patch
'@mastra/server': patch
'@mastra/core': patch
---

Fixed sub-agent version resolution in supervisor mode. Sub-agents now inherit the parent's draft/published version semantics — when chatting in the editor (draft mode), sub-agents resolve to their latest draft version; in the main agent chat (published mode), sub-agents resolve to their published version. Previously, sub-agents without explicit per-agent version overrides always fell back to the code-defined default, ignoring the parent's version context.
