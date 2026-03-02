---
"@mastra/memory": patch
---

Fixed stale continuation hints in observational memory.

When newer outputs omit continuation hints, old hints are now cleared. This prevents outdated task and response guidance from appearing in later turns.
