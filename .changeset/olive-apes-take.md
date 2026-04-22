---
'@mastra/core': patch
---

Fixed step-start and step-finish stream parts not being emitted in processOutputStream. Output processors now receive these lifecycle events, allowing developers to log, inspect, or act on step boundaries in their processOutputStream handlers.
