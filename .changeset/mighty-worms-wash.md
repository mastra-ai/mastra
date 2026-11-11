---
'@mastra/memory': patch
---

Fixed large initial Observational Memory histories loading all at once with InMemory and LibSQL storage. History is read oldest-first in bounded pages, preserving equal-timestamp messages and resuming safely after restart. Initial catch-up completes before normal asynchronous buffering resumes.
