---
'@mastra/core': patch
---

Fix Harness mode/model persistence so the saved mode's model is correctly
restored on restart. Previously, when a thread was last used in a non-default
mode (e.g. `plan` or `fast`) without an explicit per-mode model override, the
default mode's model (e.g. `build`'s) would be applied to the restored mode on
reopen. `loadThreadMetadata` now restores the saved mode first and then resolves
the model with a proper fallback chain (per-mode thread metadata → mode's
`defaultModelId` → legacy global `currentModelId`).
