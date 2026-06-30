---
'mastra': patch
---

Restructure the MastraCode web sidebar for GitHub projects into a nested project → worktree → conversations tree, with a collapsible project header and a "+ New worktree" affordance. Threads scope per worktree via the `projectPath` tag.

Remove the redundant Commit / Push / Open PR panel — the coding agent performs those operations through its own tools.

Fix the GitHub-project zero state: the welcome panel now shows the active worktree path instead of a blank workspace, and the session waits for the worktree path to resolve before connecting so the auto-created conversation is tagged correctly. Sending the first prompt now refreshes the conversation list so the new conversation appears immediately instead of staying on "No conversations yet".
