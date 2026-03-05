---
'@mastra/memory': patch
---

Improved observational memory maintainability by extracting thread-level utility functions (thread tag stripping, observation section merging, timestamp extraction, thread sorting, and observation combining) into a dedicated `thread-utils` module with dedicated unit tests. No public API or behavior changes.
