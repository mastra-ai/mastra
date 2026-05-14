---
'@mastra/core': minor
---

Harness v1 — `Session.listMessages()` shipped.

- `Session.listMessages(opts?)` returns the persisted history for the
  session's thread, oldest-first, mapped from memory storage into the
  public `HarnessMessage` shape. `opts.limit` caps to the most recent N
  messages (still oldest-first within that window); omitted returns the
  full thread history.
- `HarnessMessage` and `HarnessMessageContent` are now re-exported from
  `@mastra/core/harness/v1` (spec §11.1 — same underlying definitions as
  the legacy `@mastra/core/harness` export).
- New shared message-conversion helper at
  `packages/core/src/harness/_shared/message-conversion.ts` used by the
  v1 `Session.listMessages()` implementation. The legacy `Harness` keeps
  its private converter untouched.
- Returns `[]` when memory storage isn't configured (ad-hoc threads in
  tests, etc.) and throws once the session is closed.

Internal-only API; no breaking changes.
