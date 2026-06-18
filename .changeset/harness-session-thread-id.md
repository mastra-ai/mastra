---
'@mastra/core': patch
'mastracode': patch
---

Move Harness `currentThreadId` onto `Session.identity`

`SessionIdentity` now owns the current thread id alongside `resourceId`/`defaultResourceId`,
exposing `getThreadId()` / `setThreadId({ threadId })`. The `currentThreadId` field and the
`Harness.getCurrentThreadId()` public accessor are removed; all reads/writes inside Harness
delegate to `this.#session.identity`. Internal call sites that relied on flow-narrowing of the
old `string | null` field now capture a narrowed local before use (e.g. `renameThread`,
`*ThreadSetting`, `loadThreadMetadata`, `loadOMProgress`, signal/notification paths,
`listMessages`, tool approve/decline/resume, `persistTokenUsage`).

Consumers read the thread id via `harness.session.identity.getThreadId()`. All mastracode
production sites, e2e scenarios, and test mocks are migrated accordingly; `HarnessCompat`
delegates to the session.
