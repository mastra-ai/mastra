---
'@mastra/core': patch
---

Recalled V4 messages now preserve `data-*` message parts (e.g. `data-tool-call-suspended`) after a page refresh, so suspended HITL workflows can resume correctly.
