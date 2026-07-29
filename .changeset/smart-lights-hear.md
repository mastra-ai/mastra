---
'@mastra/factory': patch
'@mastra/code-sdk': patch
'@mastra/core': patch
---

Review sessions no longer ingest AGENTS.md or CLAUDE.md from the checked-out pull request branch. A PR branch is third-party content, so its instruction files are treated as content under review instead of trusted configuration — closing a prompt-injection path into the reviewer agent. The reviewer also runs the PR's install/build/test commands with GitHub tokens stripped from the environment.
