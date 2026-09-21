---
'@mastra/playground-ui': patch
---

Rework the Studio trace list columns:

- Rename "Created" to "Start"
- Replace the "Entity" column with a "Type" column showing an icon + label for agents, workflows, steps, tools, scorers, memory, processors, and more
- Strip the `agent run: '…'` / `workflow run: '…'` / `scorer run: '…'` prefixes from the Name column
- Reorder columns to Start → Type → Name → Input → Status → Duration → Est. cost
- Show Duration and Est. cost by default
- Reset saved column preferences to the new defaults
