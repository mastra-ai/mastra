---
'@mastra/e2b': minor
---

Added a `lifecycle` option to `E2BSandbox` so you can choose what happens when a sandbox times out. Sandboxes still pause by default and resume on next use; pass `{ onTimeout: 'kill' }` to destroy idle sandboxes instead, which suits workspaces whose data is stored outside the sandbox.
