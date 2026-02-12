---
'@mastra/e2b': patch
---

Simplified `E2BSandboxOptions` to use `Omit<MastraSandboxOptions, 'name'>` instead of explicitly picking individual lifecycle callbacks. This ensures new callbacks added to `MastraSandboxOptions` are automatically available without updating the options type.
