---
'mastracode': patch
---

Removed unnecessary Mastra instance wrapper in createMastraCode. The Agent is now created standalone and the Harness handles Mastra registration internally during init().
