---
'@mastra/platform-workspace': patch
'@mastra/e2b': patch
---

Fixed the Factory sandbox CPU setting accepting counts a sandbox can't be created with. The setting is now a list of valid counts: 1, or an even number. `PlatformFactorySandbox` offers up to 8, down from 64. `E2BFactorySandbox` offers up to 64, up from 8, and your E2B plan's own limit still applies. A Factory already saved with a count that is no longer offered goes back to the default the next time its sandbox settings are saved.
