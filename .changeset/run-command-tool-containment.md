---
'@mastra/core': patch
---

Fix three security containment gaps in `createRunCommandTool`. The unsafe-character filter used shared global regexes, so `test()` carried `lastIndex` between calls and let every second identical command through. Base command extraction ignored Windows separators, so a path like `.\bin\rm` bypassed both the blocklist and the allowlist. Working directory containment compared raw strings against `base + '/'`, which never matched on Windows and rejected every directory when the allowed base path was the filesystem root.
