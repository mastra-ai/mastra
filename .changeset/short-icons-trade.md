---
'@mastra/observability': patch
---

Fixed `MastraStorageExporter` staying disabled when a configured observability store is temporarily unavailable during startup. The exporter now recovers on a later event, so traces resume without restarting the process. (#21943)
