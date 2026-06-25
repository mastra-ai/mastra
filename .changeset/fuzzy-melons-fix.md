---
'mastracode': patch
---

Fix three MastraCode web issues:

- **Thread list leaked across git worktrees.** A single `resourceId` is shared by every worktree of a repo (it's derived from the git URL), so the sidebar showed threads from unrelated worktrees. The web app now passes the active project's path to `listThreads` so results are scoped to that working directory (the `projectPath` route/SDK support ships in `@mastra/server` / `@mastra/client-js`).
- **Slow composer typing.** Every keystroke re-rendered the entire transcript (each message re-parsing markdown and re-running syntax highlighting). The transcript is now memoized with stable handlers, so typing only re-renders the composer.
- **Chat didn't start at the latest message.** Opening or switching a thread now jumps straight to the most recent message, and a "jump to latest" button appears when you scroll up.
