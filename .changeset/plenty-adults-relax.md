---
'@mastra/core': patch
---

Fixed read-only Knowledge agents being told to edit pages. When an agent gets Knowledge read tools without write tools, its instructions, its pinned-context guidance and the `knowledge_read` tool (its description and its hint for long pages) no longer mention editing pages or `knowledge_page`. Agents with write tools get exactly the same text as before.
