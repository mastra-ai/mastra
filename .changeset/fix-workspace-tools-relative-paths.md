---
"@mastra/core": patch
---

Workspace file tools no longer use misleading absolute-path examples (e.g. `/data/output.txt`) that caused weaker LLMs to attempt writes at the actual filesystem root. The example paths in `read_file` and `write_file` are now relative.

Additionally, when a contained workspace rejects an absolute path that escapes its boundary, the resulting `PermissionError` now suggests the relative form so the agent can self-correct on the next turn (e.g. `Permission denied: access (path is outside the workspace; use a relative path like "data/output.txt") on /data/output.txt`).

Fixes #14542
