# PR #17068: fix(mastracode): recover from stale Harness v1 session leases on startup

Source: https://github.com/mastra-ai/mastra/pull/17068

Order: 24 of 34

Status: Merged at 2026-05-26T21:51:10Z

Stack edge: `fix/mastracode-v1-project-path-workspace` -> `mohamed/mastra-4344-recover-gracefully-from-stale-harness-v1-session-leases-on`

Diff size: +954 / -31; 11 changed files.

## Before

Startup could encounter stale Harness v1 session leases after crashes/restarts.

## What changed

Added recovery from stale Harness v1 session leases on startup.

## Why this is suspicious

- Confirms v1 session ownership/lease lifecycle was breaking startup.
- Recovery must not steal active sessions from another live Mastra Code process.
- Thread locks and v1 leases need consistent semantics.

## Feature surfaces to retest

- Kill Mastra Code mid-run, restart same project.
- Run two processes concurrently.
- Recover with LibSQL and PG storage.

## Commit headlines

- `0bcc4d5401` fix(mastracode): recover from stale Harness v1 session leases on startup

## Changed files

- `.changeset/cute-mails-brush.md` (+24 / -0)
- `mastracode/README.md` (+19 / -0)
- `mastracode/src/__tests__/index.test.ts` (+4 / -0)
- `mastracode/src/harness/config.ts` (+18 / -0)
- `mastracode/src/harness/index.ts` (+7 / -1)
- `mastracode/src/harness/lease-recovery-prompt.ts` (+62 / -0)
- `mastracode/src/harness/runtime.test.ts` (+424 / -0)
- `mastracode/src/harness/runtime.ts` (+326 / -27)
- `mastracode/src/index.ts` (+21 / -1)
- `mastracode/src/main.ts` (+33 / -0)
- `mastracode/src/tui/mastra-tui.ts` (+16 / -2)

## Review stance

Treat this PR as guilty until every feature surface above is manually or automatically re-proven. The presence of later compatibility fixes should be read as evidence that this migration stack repeatedly missed Mastra Code product invariants.
