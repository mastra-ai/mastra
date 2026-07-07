---
'mastracode': minor
---

Added URL-driven thread pages to the MastraCode web UI. Each conversation now lives at its own /threads/:threadId URL, so threads can be deep-linked, refreshed, and navigated with the browser's back/forward buttons.

**What changed for users**

- Clicking a thread in the sidebar navigates to its page instead of swapping content in place
- /chat is now a draft page: composing there creates the thread on first send and then navigates to /threads/:id
- The new-thread button opens the /chat draft page instead of immediately creating an empty thread
- Cloning a thread lands on the new thread's URL; deleting the active thread returns to /chat
- Thread history now loads through a cached query with a skeleton loading state instead of a blank flash
- Fixed a race where switching threads from the sidebar could show an empty transcript instead of the thread's history
