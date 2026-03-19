---
'mastracode': patch
---

Improved `/threads` so it opens quickly with batched lazy preview loading, reuses cached previews across the active TUI session, and refreshes cached previews whenever a thread's `updatedAt` changes.
