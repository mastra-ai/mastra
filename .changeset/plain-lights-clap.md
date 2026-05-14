---
'@mastra/playground-ui': patch
---

Removed the "Group traces by thread" option from the Observability traces page. The list now always displays a flat view of traces, without thread-id subheaders. To narrow results to a specific thread, use the Thread ID property in the Add filter menu (open Observability → Traces → Add filter → Thread ID → paste the threadId).
