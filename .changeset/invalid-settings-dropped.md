---
'@mastra/factory': patch
---

Fixed a saved sandbox setting staying on a value the sandbox no longer accepts. When the environment settings are read, a saved value the sandbox's settings now reject is removed and saved, so the sandbox uses its default for it and the settings page shows that default.
