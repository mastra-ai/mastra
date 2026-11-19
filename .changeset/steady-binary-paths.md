---
'@mastra/code-sdk': patch
---

Fixed the environment section of the system prompt changing on every launch when a version manager such as fnm or nvm is in use. The prompt now names each tool's installation instead of the per-shell shim directory in front of it, so the cached prompt is reused after a restart instead of being sent again in full.
