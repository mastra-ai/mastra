---
'@mastra/core': patch
---

Fixed Knowledge writes slowing down for agents that hold many scopes. A write now looks up held scopes in one query and skips the ones already in place, instead of writing every held scope on every write.
