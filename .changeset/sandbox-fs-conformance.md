---
'@mastra/code-sdk': patch
---

Sandbox filesystem operations now behave like local ones: missing files, existing destinations, and directory misuse raise typed errors instead of generic ones, reading a directory as a file fails instead of returning empty content, moving or copying a file into a new directory works, overwrite protection can no longer be raced by concurrent writers, and each filesystem reports a unique id and status.
