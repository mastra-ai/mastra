---
"@mastra/core": patch
---

Improved nested agent and workflow-as-tool streaming by forwarding each chunk through the tool writer with an explicit origin instead of piping workflow streams directly, so clients can map nested output consistently.
