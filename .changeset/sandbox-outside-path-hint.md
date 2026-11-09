---
'@mastra/code-sdk': patch
---

Sandbox file tools now explain why a read fails when the agent passes an absolute path outside the workspace, such as `/tmp/x/file.ts`. File tools resolve absolute paths relative to the workspace, so `/tmp/x/file.ts` reads `<workspace>/tmp/x/file.ts`. Previously the tool reported a plain "file not found" even though the file existed at its real sandbox path. The error now shows the remapped path and says to put scratch worktrees under `<workspace>/.worktrees/`. The sandbox instructions also explain how to create a worktree there and install its dependencies with `pnpm install --prefer-offline --frozen-lockfile`, then build the workspace packages it tests against.
