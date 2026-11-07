---
'@mastra/core': patch
'@mastra/mcp': patch
---

Background task lease tests can now run with a lease shorter than 3 seconds through an internal test-only setting, so lease-expiry tests finish in milliseconds instead of seconds. The supported 3-second minimum lease and all default timings are unchanged.
