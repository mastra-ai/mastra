---
'@mastra/server-adapters-test-suite': patch
---

Removed the `supportsRBAC` option from the adapter test suite config. Every built-in adapter now enforces route permissions, so the shared "Studio-only RBAC" tests always run.
