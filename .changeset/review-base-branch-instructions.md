---
'@mastra/factory': patch
'@mastra/code-sdk': patch
'@mastra/core': patch
---

Review sessions now load project AGENTS.md/CLAUDE.md from the pull request's trusted base branch instead of skipping them entirely. The working-tree copies on an untrusted checkout remain excluded from the system prompt and reminder injection; content is served from the base ref via git, and sessions without a known base ref still skip project instruction files.
