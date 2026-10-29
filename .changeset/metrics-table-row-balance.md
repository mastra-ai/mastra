---
'@mastra/playground-ui': patch
---

Fixed `MetricsTable` row content sitting 1px low: the separator line is drawn inside each row's bottom edge, so rows now get one more pixel of bottom padding and their content is centered between the lines above and below it.
