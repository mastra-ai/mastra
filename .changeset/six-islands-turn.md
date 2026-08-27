---
'@mastra/factory': patch
---

Fixed the board's review flow around deleted and freshly minted sessions. Deleting a session now also removes the session references work items held on it, so a card stops offering a session that no longer exists. Cards now trust their own session links instead of cross-checking the sidebar's workspace list, so the Review button flips to "Open session" as soon as an automated run binds its session — it used to stay stuck on "Review". While a run is underway its card now reads "Automated run in progress…" instead of "Starting an automated run…".
