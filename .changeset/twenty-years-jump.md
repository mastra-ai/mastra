---
'@mastra/playground-ui': patch
---

Fixed agent chat memory-message refreshes to update every page for the current agent without refetching other agents. `AgentMemoryPanel` now renders the clone slot without added border or padding, so callers control its spacing.
