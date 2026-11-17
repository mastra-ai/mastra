---
'@mastra/factory': patch
---

Factory sessions now tell the agent that a directory's AGENTS.md only loads when it opens files there with `view` or an edit tool, and ask it to read the applicable AGENTS.md files before its first change in a directory, including when it works through shell commands. Sessions on an untrusted checkout, such as pull request reviews, do not get this guidance, so they are not pointed at AGENTS.md files the pull request could have changed.
