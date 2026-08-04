---
'@mastra/factory': patch
---

Fixed factory sessions inheriting the personal agent instructions of the machine hosting them.

A factory should behave the same wherever it runs. It did not: alongside the repository's AGENTS.md and the skill it was started with, every session also loaded the instruction files sitting in the home directory of whatever machine hosted the factory (`~/.claude/CLAUDE.md`, `~/.mastracode/AGENTS.md`, and the other supported home directory locations). Those files are the operator's personal preferences, so the same review rule produced a differently written review depending on who was running the factory, and nothing in the session showed why.

Factory sessions now read only the repository's instructions (served from the pull request's base branch when the checkout is untrusted) and the skill. This applies to every session the factory creates: work items it picks up on its own, sessions a GitHub webhook resumes, and the ones you open yourself in the factory UI.

If you were relying on a home directory file to steer factory output, move those instructions into the repository's AGENTS.md.
