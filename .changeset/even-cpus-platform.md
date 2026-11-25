---
'@mastra/platform-workspace': patch
---

Fixed the `PlatformFactorySandbox` CPU setting accepting counts a sandbox can't be created with. The setting is now a list of valid counts: 1, 2, 4, 6 or 8. A count saved or configured before that is not on the list uses the default instead (2 unless a default is configured), so its sandboxes start again without anyone changing the setting.
