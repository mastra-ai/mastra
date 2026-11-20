---
'@mastra/playground-ui': patch
---

Fixed agent chat so the message history refreshes for the current agent after each run, without refetching other agents' conversations. `AgentMemoryPanel` now renders the `clone` slot without an added border or padding, so pass content with your own spacing.
