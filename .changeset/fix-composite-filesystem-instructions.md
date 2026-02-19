---
'@mastra/core': patch
---

Fixed `CompositeFilesystem` instructions: agents and tools no longer receive an incorrect claim that files written via workspace tools are accessible at sandbox paths. The instructions now accurately describe only the available mounted filesystems.