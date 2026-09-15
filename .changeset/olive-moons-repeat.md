---
'@mastra/memory': patch
---

Fixed the Observational Memory Observer and Reflector agents keeping Mastra's default ConsoleLogger instead of the configured logger, so their failures bypassed the configured logger.
