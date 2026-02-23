---
'mastracode': patch
---

Fixed plan mode agent to properly call submit_plan tool. The agent was generating text descriptions instead of calling the tool. Fixed by: creating dynamic mode-specific tool guidance with correct tool names, clarifying tool vs text usage with explicit exceptions for communication tools, and strengthening submit_plan call instructions with urgent language and code examples.
