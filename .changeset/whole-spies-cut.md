---
'@mastra/core': patch
---

Fixed provider-executed tools (e.g. Anthropic web_search) causing stream bail when called in parallel with regular tools. The tool-call-step now provides a fallback result for provider-executed tools whose output was not propagated, preventing the mapping step from misidentifying them as pending HITL interactions. Fixes #13125.
