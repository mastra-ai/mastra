---
'@mastra/code-sdk': patch
---

Fixed the environment section of the system prompt changing on every launch when a version manager such as fnm or nvm is in use. Each tool is now named by the directory it is installed in, keeping the tool's own name, instead of the per-shell directory in front of it, so the cached prompt is reused after a restart instead of being sent again in full.
