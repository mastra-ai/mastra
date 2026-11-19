---
'@mastra/code-sdk': patch
---

Fixed the environment section of the system prompt changing on every launch when a version manager such as fnm or nvm is in use. Each tool is now named by the directory it is installed in, keeping the tool's own name, instead of the per-shell directory in front of it, so that part of the prompt stays the same across restarts and is read from the provider's cache instead of being sent again.
