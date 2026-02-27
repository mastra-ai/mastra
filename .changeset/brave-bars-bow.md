---
'mastracode': minor
'@mastra/core': patch
---

Added /quorem slash command and TUI integration for the Quorem parallel agent feature. Users can view individual quorem agent threads with `/quorem view <agentId>`, return to the main thread with `/quorem back`, and cancel active sessions with `/quorem cancel`. Includes real-time status display showing agent progress, and event handlers for all quorem lifecycle events. Git worktree-based environment isolation is wired as the default `QuoremEnvironmentConfig` implementation.
