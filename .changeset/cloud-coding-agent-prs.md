---
'mastracode': minor
---

Extended GitHub-backed MastraCode web projects into a full cloud coding-agent write-back flow. From a connected repo project, signed-in users can now create a git worktree / feature branch inside the project's cloud sandbox, run the agent against that worktree (file edits + commands bind to the worktree path), and commit, push, and open a pull request — all from inside the sandbox via the `gh` CLI, authenticated with short-lived per-operation installation tokens that never reach the browser and are scrubbed from the remote afterward.

A new "Branch / PR" panel in the project view surfaces this: pick or create a branch, then commit and open a PR with a title/body. The active branch and worktree path are persisted on the project so reopening rebinds the same worktree. The panel shows a clear "sandbox not configured" state when no sandbox provider is set.

The sandbox base image must include both `git` and `gh`; the PR action preflights `gh --version` and surfaces an actionable error if it's missing (clone/open still work without `gh`). New per-project routes (`worktree`, `commit`, `push`, `pr`) are behind the WorkOS gate, scoped per user, re-verify repo ownership, and serialize concurrent git writes with an in-process per-project lock so tokenized remotes can't leak.

Provisioned sandboxes are torn down by the provider after an idle window (`MASTRACODE_SANDBOX_IDLE_MINUTES`, default 30); the next open detects a stopped/dead VM, clears the stale sandbox id, and re-provisions automatically. Push/PR install tokens only ever live in a per-operation remote URL or a single-process `GH_TOKEN` env and are scrubbed in a `finally`, never persisted in the sandbox or sent to the browser.
