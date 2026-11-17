---
'@mastra/code-sdk': patch
'mastracode': patch
---

Fixed `ask_user` questions not firing permission hooks. A pending question now fires `PermissionRequest` with `permission_kind: "ask_question"`, and answering or skipping it fires `PermissionResult` with decision `answered` or `dismissed`. Integrations that show a blocked state for approvals, such as terminal multiplexers, now also show it while a question waits for an answer.

`PermissionResult` now reports the `run_id` of its `PermissionRequest`. With background tools enabled, the result was previously dropped when the user answered after the suspended run had ended.
