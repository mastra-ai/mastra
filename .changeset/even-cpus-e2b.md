---
'@mastra/e2b': patch
---

Fixed the `E2BFactorySandbox` CPU setting accepting counts a sandbox can't be created with. The setting is now a list of valid counts: 1, or an even number up to 64, up from 8. Your E2B plan's own limit still applies. A count saved or configured before that is not on the list is created with the nearest count below it, so its sandboxes start again without anyone changing the setting.
