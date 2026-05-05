---
'@mastra/server': patch
'@mastra/deployer': patch
---

Fix runtime import failures when `@mastra/server` is paired with an older `@mastra/core` than its own version.

In 1.32.0, `@mastra/server` added top-level value imports of names that only exist in `@mastra/core@1.32.0+` (`MastraFGAPermissions` from `@mastra/core/auth/ee`; `branchesFilterSchema`, `branchesOrderBySchema`, `getBranchArgsSchema`, `listBranchesResponseSchema`, `getBranchResponseSchema` from `@mastra/core/storage`; `computeNextFireAt` from `@mastra/core/workflows`). When a user's project pinned `@mastra/core@1.31.0` but transitively pulled `@mastra/server@1.32.0` through `mastra` / `@mastra/deployer`, the bundled output crashed at module link time:

```
SyntaxError: The requested module '@mastra/core/auth/ee' does not provide an export named 'MastraFGAPermissions'
```

The peer-dep range on `@mastra/server` (`>=1.13.2-0 <2.0.0-0`) accepted `@mastra/core@1.31.0` without warning, so the failure surfaced only at runtime, after `mastra build` had already succeeded.

`@mastra/server` now imports these names through namespace-import shims with safe fallbacks. Modules load on any supported `@mastra/core` version; routes that depend on 1.32-only functionality continue to work on 1.32+, and on older `@mastra/core` they degrade in place (the request handler returns the same "not available" response it would on a project without that feature configured) instead of crashing the server at startup.

`@mastra/deployer` is patch-bumped so that `mastra@1.7.x` (which pulls `@mastra/deployer` via `^1.31.0`) picks up a deployer that pins the patched `@mastra/server`.
