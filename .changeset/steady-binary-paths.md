---
'@mastra/code-sdk': patch
---

Kept detected tool paths stable across launches by resolving per-shell `PATH` directory symlinks, such as fnm's multishell directories, without changing the names of the tools. That part of the system prompt no longer changes between restarts, so it can be served from the provider's prompt cache instead of being sent again.
