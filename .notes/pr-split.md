# PR split scratchpad

Original branch: split/factory-fast-session-starts (PR #21767)
Backup ref: backup/original-large-pr
Base branch: main

## Planned PRs

1. split/better-auth-org-cache
   - Scope: O(1) expiry-ordered org-cache sweep + usage example appended to
     the already-on-main better-auth-active-org changeset.
   - Files: auth/better-auth/src/index.ts, .changeset/better-auth-active-org.md
   - Note: the better-auth feature itself already landed on main via an
     earlier split; this is review polish only. No new changeset needed —
     the pending changeset on main covers the unreleased feature.
   - Verification: better-auth tsc --noEmit + vitest (67 tests)
   - Status: in progress

2. split/sdk-hooks-epipe
   - Scope: absorb async EPIPE on hook stdin so a hook that ignores stdin
     cannot crash the host process.
   - Files: mastracode/sdk/src/hooks/executor.ts, executor.test.ts,
     .changeset/hooks-epipe-crash.md (scoped, patch, @mastra/code-sdk)
   - Verification: sdk hooks tests + tsc
   - Status: PR #21796 open

3. split/core-sandbox-surface — PR #21798 open
   - Scope: supportsCheckpoints + seedCheckpointName surface, LocalSandbox
     checkpoints, platform-workspace probe restart, railway declaration
   - Files: packages/core sandbox (4), platform-workspace sandbox (2),
     railway sandbox index
   - Changesets: odd-radios-enter, hot-views-hope, three-llamas-camp,
     eleven-olives-knock, platform-sidecar-reprobe
   - Verified: core 295 pass, platform-workspace 89, railway 40
   - Note: real backup is backup/factory-fast-session-starts
     (backup/original-large-pr points at old parent branch)

## Remaining original intent (stays on #21767 for now)

- packages/core sandbox surface + workspaces/{platform-workspace,railway}
- factory rules/webhooks fixes, factory lazy sandbox/perf, factory-ui
- mastracode/web githubAppSlug comment fix (factory-app-identity)

## Drift notes

- After 1+2 merge, rebase split/factory-fast-session-starts on main; the
  extracted files should fall out of the diff.
