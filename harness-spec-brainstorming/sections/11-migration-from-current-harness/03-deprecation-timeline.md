### 11.3 Deprecation timeline

- **`@mastra/core` v1.x** — both subpaths ship and are fully supported. The
legacy export is *not* marked `@deprecated`; we don't want to nag external users
mid-major.
- **`@mastra/core` v2.0** — the legacy implementation is removed. The
`@mastra/core/harness` subpath becomes the primary import for the v1
implementation. If `@mastra/core/harness/v1` exists at v2.0, `/v1` remains a
supported compatibility alias for the full v2 major; alias removal is deferred
to a later major boundary. The canonical subpath identity rule lives in
§11.1.

In short: nothing breaks during `@mastra/core` v1, ever. The rename only happens
at v2, which is when consumers expect breaking changes anyway.
