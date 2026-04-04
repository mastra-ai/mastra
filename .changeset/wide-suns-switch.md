---
'mastra': patch
---

Fixed scorer sample to use the mastra/ model prefix when using the Memory Gateway. Previously, scorers generated during project creation would use the bare provider model string instead of routing through the gateway.
