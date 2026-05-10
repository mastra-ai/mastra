---
'@mastra/core': patch
---

Fixed evented workflow parallel and conditional runs so suspend completes only after sibling branches finish, and suspended step lists match persisted state.
