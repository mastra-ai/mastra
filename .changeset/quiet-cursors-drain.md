---
'@mastra/clickhouse': patch
---

Read the results of the serial-cursor probe and counter warm-up queries in the observability store, so their connections are freed at once instead of staying busy until the client's request timeout. This removes waits of up to 30 seconds after `init()`.
