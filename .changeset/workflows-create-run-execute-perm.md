---
'@mastra/server': patch
---

Allow `workflows:execute` to authorize `POST /workflows/:workflowId/create-run` and `POST /workflows/events`. Both routes previously required `workflows:write` (which is intended for editing workflow definitions); they now accept either `workflows:write` or `workflows:execute`. This unblocks Studio's "Run workflow" flow for roles that only have `*:execute` (e.g. WorkOS `member`) and aligns the broker push endpoint's permission with what it actually does (advance runtime state).
