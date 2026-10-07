---
'@mastra/core': patch
---

Fixed a memory leak in agents with sub-agents. Background task eligibility for sub-agents is now read from the sub-agent's tool definitions instead of fully converting its tools on every call, which retained fresh schemas in Zod's global registry and grew the heap without bound.
