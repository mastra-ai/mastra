---
'@mastra/core': patch
---

Agents can read and search sequence pages (ordered items: dated ones such as a Slack channel's messages, or ones in a set order such as runbook steps). `knowledge_read` returns a sequence's first 20 items with the page (newest first when dated, by position otherwise), reads more with `sequence: { since, until, order, parent, types, untyped, cursor, limit }`, and reads one item by its ref, `<page ref>@<item id>`. Each item shows its title, type, body, links, properties, position and parent when it has them; a child page of the sequence shows as an item with its page ref. `since` and `until` are refused on a sequence ordered by position. `knowledge_search` returns matching items alongside pages and notes, and `in`, `since`, `until`, `types` and `untyped` narrow a search to items of one sequence, a time range or some types. Items match by keyword only for now.
