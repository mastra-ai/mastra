---
'@mastra/core': patch
---

Agents can read and search sequence pages (dated items, such as a Slack channel's messages). `knowledge_read` returns a sequence's latest 20 items with the page, reads more with `sequence: { since, until, order, thread, cursor, limit }`, and reads one item by its ref, `<page ref>@<item id>`. `knowledge_search` returns matching items alongside pages and notes, and `in`, `since` and `until` narrow a search to items of one sequence or a time range. Items match by keyword only for now.
