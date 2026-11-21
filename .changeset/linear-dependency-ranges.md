---
'@mastra/deployer': patch
---

Fixed dependency range checks so a very long version range no longer stalls a build. Bounded ranges such as `>=0.2.0` are still kept.
