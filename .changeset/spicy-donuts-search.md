---
'@mastra/core': patch
---

Made Workspace.rebuildSearchIndex public so the search index can be built without init() starting the sandbox. Paths default to the configured autoIndexPaths.
