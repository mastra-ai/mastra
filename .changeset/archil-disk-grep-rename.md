---
'@mastra/archil': minor
---

Renamed `ArchilFilesystem.grep()` to `diskGrep()`. The method is an Archil-specific search API whose options and result shape differ from the new optional `WorkspaceFilesystem.grep()` capability contract in `@mastra/core`; keeping the same name would have caused the core workspace `grep` tool to call it with mismatched arguments. Update call sites from `filesystem.grep({...})` to `filesystem.diskGrep({...})`.
