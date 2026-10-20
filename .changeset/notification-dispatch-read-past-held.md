---
'@mastra/core': patch
---

Fixed notification dispatch stalling behind notifications it leaves pending. When a delivery policy holds notifications for another process's dispatcher (or they wait on an active run), `dispatchDueNotifications` now reads past them instead of re-reading the same first page every pass, so notifications behind them are still delivered. `limit` now counts only the notifications a pass delivers or fails.
