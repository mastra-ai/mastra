---
'mastracode': patch
---

Migrated TUI read-only consumers (/cost, /diff) to use harness.getDisplayState() for token usage, OM progress, and modified files. Moved OMProgressState type definitions to @mastra/core/harness, re-exporting from the component file for backward compatibility.
