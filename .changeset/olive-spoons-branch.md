---
'mastra': patch
'@mastra/react': minor
'@mastra/playground-ui': minor
---

Added shared-history conversation branching to Studio. Each message now carries a "Branch from here" action that forks the conversation at that point into a new thread sharing history up to the fork; both the source and branch views render an inline marker at the fork point with links between parent and branch, and the memory sidebar lists a thread's branches with links to each (the first 100, with a note when there are more).

`@mastra/react` exports `useThreadBranches`, `useBranchThread` and the `ThreadBranchesInfo` type for listing a thread's branches and fetching a branch's message history, and `@mastra/playground-ui` exports the branch action and fork marker components plus `messageFooter`/`afterMessage` slots on the chat thread for rendering per-message controls.
