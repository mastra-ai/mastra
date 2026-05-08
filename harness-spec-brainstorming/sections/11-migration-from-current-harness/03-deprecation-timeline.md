### 11.3 Deprecation timeline

- **`@mastra/core` v1.x** — both subpaths ship and are fully supported. The legacy export is *not* marked `@deprecated`; we don't want to nag external users mid-major.
- **`@mastra/core` v2.0** — the legacy implementation is removed. The `@mastra/core/harness` subpath becomes the v1 implementation (the `/v1` subpath is kept as an alias for one minor version, then dropped).

In short: nothing breaks during `@mastra/core` v1, ever. The rename only happens at v2, which is when consumers expect breaking changes anyway.
