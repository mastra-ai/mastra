---
'@mastra/core': patch
---

Fixed `MessageList` adds from memory being quadratic in the number of stored messages. Loading a long conversation history (every storage adapter's `listMessages` runs its rows through `MessageList.add(rows, 'memory')`, and Observational Memory reads the whole unobserved tail) compared each new message against every stored one and re-sorted the list after each add, so 8 000 messages took over a second and 20 000 several seconds on the event loop. The list now keeps an id index and skips the re-sort when a message is appended in order: 20 000 messages load in tens of milliseconds. Dedup, replace-by-id, sealed-message and ordering behaviour are unchanged and covered by tests.
