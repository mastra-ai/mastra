---
'@mastra/core': patch
---

Durable agents attached to a chat channel now render their final answer after a tool call. Previously the first tool step ended channel rendering, so the tool cards posted but the answer that followed was silently dropped — the run still reported success and saved the message to the thread. Any output processor reading `stepResult.isContinued` on `step-finish` chunks now receives it on durable runs too, matching regular agent runs, including when a tool error makes the loop continue past a model `stop`. Fixes #23341.
