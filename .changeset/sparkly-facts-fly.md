---
'@mastra/factory': patch
---

Added per-repository groups to the chat sidebar for sessions with several repositories.

- The Changes view groups changes by repository slug and shows the provider icon.
- The Files view groups files by checkout directory. It also lists files written at the workspace root during the session. Dotfiles such as `.env` are never listed.
- The agent's file tools and project path start at the workspace root, and each repository's `AGENTS.md` and project skills load.

Sessions with one repository work as before.
