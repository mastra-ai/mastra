---
'@mastra/factory': patch
---

Let a Factory agent find work items by the name a board is shown under, not only its stored id.

A project can rename a board without changing its id, so the work-item header reads `Board: Open source (work)` while the card is stored on the board `work`. `factory_list_work_items` accepted only the id in its `board` filter, so asking it for "the Open source board" matched nothing and the agent reported that no such board existed.

The filter now takes either: an id, or the displayed name in any case. An id always wins, and a name resolves only when one board carries it — two boards can share a display name, and then the call fails naming both ids rather than guessing. A name no board carries fails too, listing the boards the project has. Every listed and inspected card now reports its board's name (`boardName`) beside its id (`board`), so the two are visible together.
