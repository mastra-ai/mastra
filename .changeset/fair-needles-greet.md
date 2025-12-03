---
'@mastra/deployer': patch
---

Fixed a bug where ESM shims were incorrectly injected even when the user had already declared `__filename` or `__dirname`
