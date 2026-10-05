---
'@mastra/core': patch
---

Fixed signal markup changing after a message is loaded from storage. Signal attributes are now written in a stable, sorted order, so a user message renders the same on every turn even when storage (for example Postgres `jsonb`) returns the attribute keys in a different order. This keeps provider prompt caches valid across turns.
