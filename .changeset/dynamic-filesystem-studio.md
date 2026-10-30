---
'@mastra/server': patch
'@mastra/client-js': patch
'@mastra/react': patch
'mastra': patch
---

Workspace routes now report `capabilities.hasDynamicFilesystem` when the filesystem comes from a resolver. File routes can't browse that filesystem, so Studio's workspace page now explains that the filesystem is resolved per request instead of showing a file tree that fails to load.
