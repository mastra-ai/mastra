---
'@mastra/playground-ui': patch
---

- Removes redundant "Working Memory" section from memory config panel (already displayed in dedicated working memory component)
- Fixes badge rendering for falsy values by using ?? instead of || (e.g., false was incorrectly displayed as empty string)
- Adds tooltip on disabled "Edit Working Memory" button explaining that working memory becomes available after the agent calls updateWorkingMemory
