---
'@mastra/core': patch
---

Fixed Knowledge agents being told to use tools they don't have. When an agent gets Knowledge read tools without write tools, its instructions, its pinned-context guidance and the `knowledge_read` tool (its description and its hint for long pages) no longer mention editing pages or `knowledge_page`. When an agent has no read tools (write-only or pinned-only), its pinned-context guidance, its pinned entries (cut-off pages, cut-off listings and the line naming pins that didn't fit) and the `knowledge_page` and `knowledge_pin` tools no longer mention `knowledge_read`, `knowledge_search` or `knowledge_list`. `getPinnedContext()` takes the same `read` option as `createTools()`, so hosts that hand out no read tools get pinned entries that name none. Agents with both read and write tools get exactly the same text as before.
