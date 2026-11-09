---
'@mastra/core': patch
---

Faster Knowledge writes for agents that hold many scopes. Starting a write now looks up the held scopes in one query (or one per 1,000 scopes) and skips the store call for scopes that already exist, have their template children, and need no new parent link, instead of writing every held scope on every write. Scopes whose declaration has template pages still go through the store each write so missing pages are restored. Placement, warnings and errors are unchanged.
