---
'@internal/playground': patch
---

Improved Studio reconnect behavior after dev server restarts by spreading retry attempts over time to prevent many clients reconnecting at once. Also fixed a memory leak from repeated event handler registration during reconnects.
