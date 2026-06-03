# PR #17042: fix: stabilize MastraCode Harness v1 startup and resumes

Source: https://github.com/mastra-ai/mastra/pull/17042

Order: 25 of 34

Status: Merged at 2026-05-26T22:42:51Z

Stack edge: `feat/mastracode-harness-v1-runtime` -> `fix/mastracode-v1-project-path-workspace`

Diff size: +1409 / -175; 20 changed files.

## Before

The initial runtime adoption had startup/resume and workspace/project path issues, plus YOLO/sandbox context gaps.

## What changed

Stabilized Mastra Code Harness v1 startup/resumes, preserved project-path workspace context, restored YOLO resume permissions, and fixed sandbox access workspace context.

## Why this is suspicious

- This PR is evidence that the first migration broke core startup/resume and permission behavior.
- Workspace context bugs are especially dangerous because they can grant/deny wrong filesystem paths.
- YOLO mismatch means permission state was not being read consistently.

## Feature surfaces to retest

- Resume a thread after restart.
- request_access then use newly allowed path.
- YOLO then run execute_command without prompt.
- Project root and cwd in system prompt/tools.

## Commit headlines

- `cf3ddc27f5` fix(mastracode): restore v1 startup context
- `64cca04e8e` fix(mastracode): respect yolo tool approvals
- `d4d7652674` fix(mastracode): resume sandbox access with workspace context
- `839317ffa3` chore: remove Harness v1 fix changesets
- `24f6f83320` fix(mastracode): recover from stale Harness v1 session leases on star…
- `17f3bb6614` Merge parent Harness v1 runtime branch
- `4509352c18` fix(mastracode): preserve yolo resume permissions

## Changed files

- `.changeset/cute-mails-brush.md` (+24 / -0)
- `mastracode/README.md` (+19 / -0)
- `mastracode/src/__tests__/index.test.ts` (+47 / -0)
- `mastracode/src/harness/config.ts` (+18 / -0)
- `mastracode/src/harness/index.ts` (+7 / -1)
- `mastracode/src/harness/lease-recovery-prompt.ts` (+62 / -0)
- `mastracode/src/harness/runtime.test.ts` (+541 / -20)
- `mastracode/src/harness/runtime.ts` (+379 / -76)
- `mastracode/src/index.ts` (+27 / -5)
- `mastracode/src/main.ts` (+33 / -0)
- `mastracode/src/permissions.ts` (+4 / -2)
- `mastracode/src/tools/__tests__/request-sandbox-access.test.ts` (+11 / -7)
- `mastracode/src/tools/request-sandbox-access.ts` (+36 / -14)
- `mastracode/src/tui/mastra-tui.ts` (+16 / -2)
- `packages/core/src/harness/v1/session.message.test.ts` (+4 / -0)
- `packages/core/src/harness/v1/session.suspend.test.ts` (+71 / -2)
- `packages/core/src/harness/v1/session.ts` (+94 / -35)
- `packages/core/src/loop/workflows/agentic-execution/tool-call-step.test.ts` (+2 / -2)
- `packages/core/src/loop/workflows/agentic-execution/tool-call-step.ts` (+12 / -9)
- `packages/core/src/storage/domains/harness/types.ts` (+2 / -0)

## Review stance

Treat this PR as guilty until every feature surface above is manually or automatically re-proven. The presence of later compatibility fixes should be read as evidence that this migration stack repeatedly missed Mastra Code product invariants.
