---
'@mastra/factory': patch
---

Factory sessions now tell the agent that a directory's AGENTS.md only loads when it opens files there with `view` or an edit tool. When the agent reaches files only through shell commands, it is told to read the applicable AGENTS.md before changing them, so directory-specific instructions such as the docs checks are no longer missed.
