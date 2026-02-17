---
'@mastra/core': patch
'@mastra/workspace-tools': patch
---

Add `@mastra/workspace-tools` package with standalone workspace tool exports that can be versioned independently from core. Tools use `context.workspace` instead of closure-captured references.

Core: `WorkspaceConfig.tools` now accepts tool overrides (`Record<string, Tool>` or `({ workspace, requestContext }) => Record<string, Tool>`) in addition to the existing `WorkspaceToolsConfig`. Added `workspace.getTools({ requestContext })` for resolving tools at request time.
