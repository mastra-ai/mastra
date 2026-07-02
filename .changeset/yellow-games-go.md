---
'@mastra/core': patch
---

Fixed subagent delegations wasting an LLM call on title generation. When a supervisor agent's Memory has generateTitle enabled and delegates to a subagent with no memory of its own, the subagent inherited the supervisor's Memory instance and its generateTitle setting, firing an extra title-generation call for every ephemeral delegation thread that no one ever sees. Title generation is now treated as a top-level thread concern and is suppressed for these ephemeral subagent threads. To generate titles for a subagent's own threads, give that subagent its own memory configuration.
