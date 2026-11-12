---
'mastra': patch
---

Improved Factory search (⌘K) on large boards. Opening it no longer downloads every card of the project: it loads the 20 most recently updated cards nobody has started, and asks the server for the cards matching what you type once you pause typing.

What changes when you search:

- A card nobody has started is found by its title, key, number or source id. Typing a stage name, a source label, a URL or a branch no longer finds it.
- A card that holds a session is still found the way it was, through its session row.
- Up to 20 matching unstarted cards are listed. The "Work items" count still counts every one of them.
- Up to 20 open issues and pull requests that have no card yet are offered, the best matches for what you typed first.

`mastra api` can also pass the work-item list route's new filters: `started`, `q`, `limit` and `source`.
