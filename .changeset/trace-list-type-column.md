---
'@mastra/playground-ui': patch
---

Rework the Studio trace list columns: rename "Created" to "Start", replace the "Entity" column with a "Type" column (icon + label for agents, workflows, steps, tools, scorers, memory, processors, and more), strip the `agent run: '…'` / `workflow run: '…'` / `scorer run: '…'` prefixes from the Name column, reorder to Start → Type → Name → Input → Status → Duration → Est. cost, and show Duration and Est. cost by default. Saved column preferences are reset to the new defaults.
