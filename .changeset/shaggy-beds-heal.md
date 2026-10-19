---
'@mastra/code-sdk': patch
---

Made content search in sandbox workspaces much faster when ripgrep isn't installed. Searches now run as a single GNU grep command with context lines, using git to respect every repository's `.gitignore`, instead of reading files one by one. With ripgrep, searches also respect `.gitignore` files now. Both skip `node_modules` unless the search path points inside it. File listings in sandbox workspaces also skip `node_modules` inside the sandbox instead of returning it to be filtered out.
