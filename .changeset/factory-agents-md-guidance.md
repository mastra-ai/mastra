---
'@mastra/factory': patch
---

Factory sessions now tell the agent that a directory's AGENTS.md only loads when it opens files there with `view` or an edit tool, and to read the applicable AGENTS.md files before its first change in a directory. Directory-specific instructions, such as the docs checks, are no longer missed when the agent works through shell commands. Sessions on an untrusted checkout, such as pull request reviews, do not get this guidance, so they are never pointed at AGENTS.md files the pull request could have changed.
