---
'@mastra/core': patch
---

Fixed Claude 4.6 agents failing with "does not support assistant message prefill" during thread resumption, agent handoffs, and tool-call rounds. Previously, only structured output calls were guarded against trailing assistant messages — now all cases are covered. Fixes #13969.
