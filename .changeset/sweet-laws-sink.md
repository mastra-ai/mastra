---
'@mastra/core': major
---

Changed .branch() result schema to make all the fields optional.

This is a breaking change for existing workflows whose schema may be expecting non-optional fields.
