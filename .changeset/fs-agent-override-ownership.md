---
'@mastra/server': patch
---

Fixed Studio overrides for file-based agents to store and export only fields allowed by the agent's `editor` ownership settings. Description-only tool edits cannot change tool selection or rules. Conditional description overrides are rejected when project-owned variant rules are unavailable.
