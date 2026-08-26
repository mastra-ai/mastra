---
'@mastra/factory': patch
---

Add a bulk action that applies a Factory project's default model to its already-running work and review sessions. Previously, changing the default model only affected sessions started afterwards, so recovering from a rate-limited model meant switching the model by hand in every open session. `POST /web/factory/projects/:id/apply-default-model` now walks the project's active run bindings, switches each live session to the project default, and reports which sessions were switched and which were idle (idle sessions pick the default up on their next start). The Factory settings UI exposes this as an "Apply to running sessions" button next to the default model picker.
