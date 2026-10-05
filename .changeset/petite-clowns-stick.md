---
'@mastra/playground-ui': patch
---

Fixed uneven spacing in RelativeTimestamp when it sits inside a sentence such as "Deployed 1h ago". Only short labels like "1h" stay monospace; words like "ago" and full dates now match the surrounding text.
