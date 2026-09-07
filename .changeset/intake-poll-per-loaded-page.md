---
'@mastra/factory': patch
---

The board's candidate poll now spaces itself out by the number of loaded pages: every 30 seconds with one page, every minute with two, and so on. Each poll replays every loaded page through GitHub, so a tab costs the same however far the Intake column has been scrolled. Returning to the tab still refreshes at once.
