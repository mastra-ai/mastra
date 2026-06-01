---
'@mastra/server': patch
---

Lazy-load `@mastra/core/tool-provider` inside the tool-provider handler so
`@mastra/server` evaluates under any peer-compatible `@mastra/core` (peer floor
remains `>=1.34.0-0`). The handler no longer imports `SHARED_BUCKET_ID` or
`UnknownToolProviderError` at module load — `SHARED_BUCKET_ID` is mirrored as a
local literal (verified in lockstep with core via a regression test), and
`UnknownToolProviderError` is resolved via a cached `await import(...)` inside
`resolveProvider` so the real class identity is preserved for `instanceof`.

OSS users running `Mastra` without a `MastraEditor` are unaffected: every
tool-provider route still short-circuits with HTTP 500 "Editor is not
configured" via `requireEditor(...)` before any core/tool-provider value is
touched. Users with a `MastraEditor` already pull a compatible core
transitively through `@mastra/editor`. Tool-provider routes require the new
core exports at request time only — older cores surface a clear runtime error
instead of crashing the server at boot.
