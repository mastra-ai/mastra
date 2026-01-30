---
'@mastra/server': patch
'@mastra/core': patch
---

Fixed skill validation to accept flexible compatibility and metadata types from external skills. Skills from skills.sh and other sources can now use objects for compatibility (e.g., `{ claude_code: ">= 1.0.0" }`) and arrays/objects in metadata fields (e.g., `keywords: ["skills", "search"]`).
