---
'mastracode': patch
---

Cleaned up the MastraCode web studio chrome. Removed the duplicate top-level project switcher from the header (the left sidebar's switcher is now the single source for switching projects), and moved the Settings button from the top-right of the header into the sidebar footer. The header is now reduced to just the mobile sidebar toggle. The agent chat message column was widened to `max-w-[80ch] w-full` and gains more vertical room from the leaner header. The composer and status line now share the same `max-w-[80ch] w-full` column as the message list (with the status line kept below), and their border/background container styling was removed so they align cleanly with the chat.
