---
'@mastra/memory': patch
---

Fixed Observational Memory recording the agent's findings as part of what the user asked. The Observer and Reflector now keep lines about what the user asked or stated to the user's own words, and record names, dates and answers the agent or a tool found in a separate observation attributed to the agent or tool. Those findings are kept, not dropped. Refs #29792
