---
'@mastra/core': patch
---

Fixed `mastra_workspace_list_files` silently returning no files when agents passed an empty `pattern` (e.g. `pattern: []` or `pattern: ''`). Empty and whitespace-only patterns are now treated as "no filter" and return the full listing instead of a dirs-only view or a picomatch error.

Fixed harness tool approval, decline, and resume handlers hardcoding `requireToolApproval: true`. They now follow the harness `yolo` state like `sendMessage` already does, so resumed tool calls in yolo mode no longer get unexpectedly re-gated on approval.
