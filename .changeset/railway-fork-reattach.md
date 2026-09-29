---
'@mastra/railway': patch
---

Fixed `RailwaySandbox.fork()` returning a freshly created sandbox instead of the fork. The returned sandbox now attaches to the forked Railway sandbox, so it carries the source filesystem and the fork is no longer left running unattached.
