---
'@mastra/code-sdk': patch
'mastracode': patch
---

Fixed the update check treating a prerelease, such as `1.2.0-alpha.1`, as already up to date when its stable release (`1.2.0`) is out. `/update`, `mastracode update`, and the startup update notice now offer the stable release.
