---
'@mastra/core': patch
---

Improved the `pattern` field description in the `list_files` workspace tool to prevent AI models from passing `"*"` when they intend to match all files. The description now clarifies that omitting `pattern` lists all files, that `*` only matches within a single directory level (standard glob), and that glob patterns only filter files while directories are always shown.
