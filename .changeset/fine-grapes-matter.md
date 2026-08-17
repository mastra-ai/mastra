---
'@mastra/core': patch
---

Fixed tool request context schemas to pass transformed values, coercions, and defaults to execute while retaining input-form values for nested validation. Explicit mutations now preserve schema input encoding and reject unencodable transformed writes without corrupting the shared context.
