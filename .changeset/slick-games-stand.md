---
'@mastra/playground-ui': patch
---

Fixed double-counted cache token costs in the Metrics dashboard. The Model Usage & Cost table and the Token Usage by Agent table were summing cache read/write costs on top of the total input cost, which already includes them — now they only sum total input + total output cost.
