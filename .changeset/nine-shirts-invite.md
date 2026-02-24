---
'mastracode': patch
---

Updated `/cost` and `/diff` commands to read token usage, memory progress, and modified files from the Harness display state instead of maintaining separate local copies. Moved shared type definitions (`OMProgressState`, `OMStatus`, `OMBufferedStatus`) to `@mastra/core/harness` and re-exported them for backward compatibility.
