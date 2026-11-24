---
'@mastra/core': patch
---

Agents can read and search timeline pages (dated entries, such as a Slack channel's messages). `knowledge_read` returns a timeline's latest 20 entries with the page, reads more with `timeline: { since, until, order, thread, cursor, limit }`, and reads one entry by its ref, `<page ref>@<entry id>`. `knowledge_search` returns matching entries alongside pages and notes, and `in`, `since` and `until` narrow a search to entries of one timeline or a time range. Entries match by keyword only for now.
