---
'@mastra/core': patch
---

Fixed ConsoleLogger.warn() to correctly call console.warn() instead of console.info(), ensuring warn-level logs are routed to stderr and properly classified by log backends (e.g. Datadog)
