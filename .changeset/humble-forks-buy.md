---
'@mastra/memory': patch
---

Fixed CPU usage that kept growing when observational memory was created per request. Apps that build a new `Memory` instance for each request no longer slow down over time on Node.js versions before 24.
