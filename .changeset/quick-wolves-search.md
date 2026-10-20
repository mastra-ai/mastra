---
'@mastra/code-sdk': patch
---

Improved content search in sandbox workspaces without ripgrep. When the sandbox's GNU grep and git support PCRE, patterns run with `grep -P` and `git grep -P`, so `\d`, `\w`, `\s`, `\b`, and lookarounds are searched in one command instead of falling back to reading files one by one.
