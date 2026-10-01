---
name: worktrees-and-dev-servers
description:
  Use when working with the repo's moonx root:wt worktree helper, Pierre-managed
  worktrees, dev-server port offsets, stale server cleanup, Playwright fixtures,
  or Chrome debug instances. Do not use this as a substitute for host-provided
  workspace isolation.
---

# Worktrees and Dev Servers

Pierre includes a repo-specific `git worktree` helper for local/manual
parallelization outside host-managed agent workspaces. Managed Pierre worktrees
live at:

```text
~/pierre/pierre-worktrees/<slug>/
```

Each managed Pierre worktree owns a port offset so dev servers, E2E fixtures,
and the Chrome remote-debug instance do not collide. The main clone keeps
historical default ports; linked Pierre worktrees shift ports.

If you are already inside a Conductor, Codex, Claude, or other host-provided
workspace, do not create another worktree unless the user explicitly asks for a
Pierre-managed worktree. Still use this skill when you start repo dev servers or
E2E fixtures, because the cleanup and port-offset rules apply to those scripts.

## Worktree Commands

The `wt` suite is defined in `scripts/wt.ts`, exposed as the `root:wt` moon
task, and manages only Pierre-managed worktrees:

```bash
moonx root:wt -- new <slug>    # create a worktree, allocate offset, pnpm install
moonx root:wt -- rm <slug>     # kill its processes, remove the worktree
moonx root:wt -- clean         # kill zombie servers on all managed worktree ports
moonx root:wt -- clean <slug>  # clean one managed worktree
moonx root:wt -- ps            # show per-worktree port status (LISTEN / -)
moonx root:wt -- list          # summary of managed + external worktrees
```

Port-binding moon tasks read the offset from `<worktree>/.env.worktree` via
their `envFile` option. Before starting, dev tasks run `scripts/run-dev.sh` to
kill any stale process bound to the target port.

## Cleanup Contract

If you start dev servers, Playwright fixtures, or Chrome debug instances inside
a worktree, run cleanup before completing your turn:

```bash
moonx root:wt -- clean <slug>
```

Use `moonx root:wt -- clean` when you do not know the slug or need to clean
every managed worktree. Use `moonx root:wt -- rm <slug>` only when intentionally
tearing down the worktree itself.
