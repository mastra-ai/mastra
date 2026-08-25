---
'@mastra/code-sdk': patch
'@mastra/core': patch
---

Improved workspace `grep` and `list_files` tool performance on remote filesystems. The `list_files` tree walk now issues directory listings concurrently instead of one at a time, and `WorkspaceFilesystem` providers can implement optional `walk()` and `grep()` methods to run tree walks and content searches natively in a single call. The workspace tools use these capabilities automatically when available and fall back to the existing host-side walk otherwise, so a grep over a remote sandbox filesystem no longer needs one network round trip per directory and file. Fixes https://github.com/mastra-ai/mastra/issues/22285
