---
'@mastra/core': patch
---

Fixed an issue where browser/client-side tool results created duplicate assistant messages in memory on every round-trip, causing prompt size to grow exponentially (20K → 54K → 118K → 147K tokens). Assistant messages now remain deduplicated and tool results are correctly persisted, so prompt size stays stable across round-trips. (Fixes #14602)
