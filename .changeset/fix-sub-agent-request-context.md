---
"@mastra/core": patch
---

Sub-agents with dynamic model configurations were broken because `requestContext` was not being passed to `getModel()` when creating agent tools. This caused sub-agents using function-based model configurations to receive an empty context instead of the parent's context.

No code changes required for consumers - this fix restores expected behavior for dynamic model configurations in sub-agents.
