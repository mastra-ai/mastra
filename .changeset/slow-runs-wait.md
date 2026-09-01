---
'@mastra/factory': patch
---

Fixed the dispatcher declaring a false start on a skill run longer than ten minutes and kicking off a duplicate into a session that was still working. It now keeps observing a leased run the run registry still shows in flight, and fails a run as overdue after six hours so a hung run cannot hold its lease and dispatch slot forever.
