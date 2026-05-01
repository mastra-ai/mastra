---
"@mastra/core": patch
---

Workspace file tools no longer use misleading absolute-path examples (e.g. `/data/output.txt`) that caused weaker LLMs to attempt writes at the actual filesystem root. The example paths in `read_file` and `write_file` are now relative.

Additionally, when a contained workspace rejects an absolute path that escapes its boundary, the resulting `PermissionError` now guides the agent toward a relative path so it can self-correct on the next turn. When the path's first segment names a real directory in the workspace (e.g. `/src/app.ts` with an existing `src/`), the error suggests the exact relative form. Otherwise it falls back to a generic hint instead of inventing a misleading suggestion for genuinely out-of-workspace paths like `/etc/passwd`.

Fixes #14542
