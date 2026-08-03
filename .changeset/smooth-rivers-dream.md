---
'@mastra/factory': patch
---

Fixed factory sessions inheriting the personal agent instructions of the machine hosting them.

A factory run working an issue or reviewing a pull request should behave the same everywhere. It did not: alongside the repository's AGENTS.md and the skill it was started with, every run also loaded the instruction files sitting in the home directory of whatever machine hosted the factory (`~/.claude/CLAUDE.md`, `~/.mastracode/AGENTS.md`, and the other supported home directory locations). Those files are the operator's personal preferences, so the same review rule produced a differently written review depending on who was running the factory, and nothing in the session showed why.

Sessions bound to a work item now skip global instruction files entirely. They read only what a reviewer can see: the repository's instructions (served from the pull request's base branch when the checkout is untrusted) and the skill. Interactive sessions you drive yourself are unchanged and still pick up your home directory instructions.

If you were relying on a home directory file to steer factory output, move those instructions into the repository's AGENTS.md.
