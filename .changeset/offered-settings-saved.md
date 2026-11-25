---
'@mastra/factory': patch
---

Fixed a saved sandbox setting staying on a number its setting no longer offers. When the environment settings are read or saved, a number that is not one of its setting's listed choices is replaced with the nearest choice below it, so the settings page shows what the sandbox runs with.
