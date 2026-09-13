---
'@mastra/core': patch
---

Fix type identity for Hono types crossing the public API. `hono` is now a peer dependency of `@mastra/core` and its declarations are no longer vendored into `dist/_types`, so published types import from the consumer's own `hono` install. Passing a Hono `Context` or `MiddlewareHandler` to `registerApiRoute` no longer fails typechecking under `"moduleResolution": "bundler"` with TS2322 nominal-mismatch errors. Fixes #22774
