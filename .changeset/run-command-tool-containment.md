---
'@mastra/core': patch
---

Fixed command validation in `createRunCommandTool`.

- Reject repeated commands containing unsafe characters, not just the first occurrence.
- Apply the command blocklist and allowlist to Windows-style command paths.
- Allow valid working directories on Windows and under a filesystem-root base path.
- Reject working directories that climb outside the configured base paths.
