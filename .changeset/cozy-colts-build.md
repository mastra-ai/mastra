---
'@mastra/core': patch
---

Fixed an issue in the agentic loop where an aborted or failed LLM stream would still trigger output processors and improperly persist the user's input message as an orphaned record.
