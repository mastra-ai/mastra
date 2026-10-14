---
'@mastra/factory': patch
---

Sessions with several repositories now report changes and touched files per repository.

- Each repository's changes carry its slug and provider.
- Touched files are grouped by checkout directory, and files written at the workspace root during the session are listed too. Dotfiles such as `.env` are never listed.
- The agent's file tools and project path start at the workspace root, and each repository's `AGENTS.md` and project skills load.

Sessions with one repository work as before.
