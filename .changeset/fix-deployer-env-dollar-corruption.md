---
'@mastra/deployer': patch
---

Fix `FileEnvService.setEnvValue` corrupting env values that contain `$` when updating an existing key. Values such as database URLs and passwords that include `$&`, `$$`, or `$1` are now written exactly as provided instead of being mangled by `String.prototype.replace` special patterns. Closes #18633.
