# PR #17511: fix(mastracode): fall back to legacy switchMode when no session is active

Source: https://github.com/mastra-ai/mastra/pull/17511

Order: 32 of 34

Status: Merged at 2026-06-03T12:57:20Z

Stack edge: `main` -> `devin/1780487978-fix-switchmode-no-session`

Diff size: +22 / -4; 3 changed files.

## Before

`HarnessCompat.switchMode()` assumed an active v1 session existed.

## What changed

Fell back to legacy `switchMode` when no v1 session is active.

## Why this is suspicious

- Confirms compat methods can be called before/without v1 session initialization.
- Other methods may have the same missing fallback bug.
- Mode switching during startup/thread creation remains timing-sensitive.

## Feature surfaces to retest

- Switch mode immediately on startup.
- Switch mode after thread change but before first run.
- Headless `--mode` with no existing session.

## Commit headlines

- `cc60c9cff8` fix(mastracode): fall back to legacy switchMode when no session is ac…

## Changed files

- `.changeset/plain-laws-go.md` (+5 / -0)
- `mastracode/src/HarnessCompat.test.ts` (+15 / -0)
- `mastracode/src/HarnessCompat.ts` (+2 / -4)

## Review stance

Treat this PR as guilty until every feature surface above is manually or automatically re-proven. The presence of later compatibility fixes should be read as evidence that this migration stack repeatedly missed Mastra Code product invariants.
